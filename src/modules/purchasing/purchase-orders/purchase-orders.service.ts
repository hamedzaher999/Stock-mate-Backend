import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PurchaseOrdersRepository } from './purchase-orders.repository';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ListPurchaseOrdersDto } from './dto/list-purchase-orders.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { generateRequestNumber } from '../../../common/utils/request-number-generator.util';
const ORDERABLE_PR_STATUSES = ['approved', 'ready_for_receiving'];

@Injectable()
export class PurchaseOrdersService {
    constructor(
        private readonly purchaseOrdersRepository: PurchaseOrdersRepository,
    ) {}

    async list(dto: ListPurchaseOrdersDto): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } = await this.purchaseOrdersRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            purchaseRequestId: dto.purchaseRequestId,
            status: dto.status,
        });

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findById(id: string) {
        const order = await this.purchaseOrdersRepository.findById(id);
        if (!order) throw new NotFoundException('Purchase order not found.');
        return order;
    }

    async create(dto: CreatePurchaseOrderDto, createdById: string) {
        const pr =
            await this.purchaseOrdersRepository.findPurchaseRequestForOrder(
                dto.purchaseRequestId,
            );
        if (!pr)
            throw new BadRequestException('Purchase request does not exist.');
        if (!ORDERABLE_PR_STATUSES.includes(pr.status)) {
            throw new ConflictException(
                'Purchase orders can only be created for approved or ready-for-receiving requests.',
            );
        }

        const supplier = await this.purchaseOrdersRepository.supplierExists(
            dto.supplierId,
        );
        if (!supplier)
            throw new BadRequestException('Supplier does not exist.');
        if (!supplier.isActive)
            throw new BadRequestException(
                'Cannot place an order with an inactive supplier.',
            );

        const warehouse =
            await this.purchaseOrdersRepository.findWarehouseDepartment();
        if (!warehouse) {
            throw new BadRequestException(
                'No Central Warehouse department is configured -- cannot create a purchase order.',
            );
        }

        const items: {
            purchaseRequestItemId: string;
            variantId: string;
            orderedQuantity: number;
            unitPrice?: number;
        }[] = [];

        for (const inputItem of dto.items) {
            const prItem = pr.items.find(
                (i) => i.id === inputItem.purchaseRequestItemId,
            );
            if (!prItem)
                throw new BadRequestException(
                    'One or more items do not belong to this purchase request.',
                );
            if (prItem.committeeApprovedQuantity === null) {
                throw new BadRequestException(
                    'This item has not been approved with a quantity by the committee yet.',
                );
            }
            if (!prItem.variant.isActive || !prItem.variant.product.isActive) {
                throw new BadRequestException(
                    'One or more variants on this request have since been deactivated.',
                );
            }
            const alreadyOrdered =
                await this.purchaseOrdersRepository.sumOrderedQuantityForRequestItem(
                    prItem.id,
                );
            const alreadyOrderedQty = Number(
                alreadyOrdered._sum.orderedQuantity ?? 0,
            );
            const remaining =
                Number(prItem.committeeApprovedQuantity) - alreadyOrderedQty;

            if (inputItem.orderedQuantity > remaining) {
                throw new BadRequestException(
                    `Ordered quantity exceeds the remaining approved quantity (remaining: ${remaining}).`,
                );
            }

            items.push({
                purchaseRequestItemId: prItem.id,
                variantId: prItem.variantId,
                orderedQuantity: inputItem.orderedQuantity,
                unitPrice: inputItem.unitPrice,
            });
        }

        return this.purchaseOrdersRepository.create({
            orderNumber: generateRequestNumber('PO'),
            purchaseRequestId: dto.purchaseRequestId,
            supplierId: dto.supplierId,
            destinationDepartmentId: warehouse.id,
            createdById,
            expectedDeliveryDate: dto.expectedDeliveryDate
                ? new Date(dto.expectedDeliveryDate)
                : undefined,
            items,
        });
    }

    async send(id: string) {
        const order = await this.findById(id);
        if (order.status !== 'draft')
            throw new ConflictException(
                'Only draft purchase orders can be sent.',
            );
        return this.purchaseOrdersRepository.send(id);
    }

    async cancel(id: string) {
        const order = await this.findById(id);
        if (order.status !== 'draft' && order.status !== 'sent') {
            throw new ConflictException(
                'Only draft or sent purchase orders can be cancelled.',
            );
        }
        if (order.items.some((item) => Number(item.receivedQuantity) > 0)) {
            throw new BadRequestException(
                'Cannot cancel an order that has already received partial shipments.',
            );
        }
        return this.purchaseOrdersRepository.cancel(id);
    }
}
