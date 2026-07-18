import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PurchaseReceivingRepository } from './purchase-receiving.repository';
import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto';
import { ListPurchaseReceiptsDto } from './dto/list-purchase-receipts.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';

const RECEIVABLE_ORDER_STATUSES = ['sent', 'partially_received'];

@Injectable()
export class PurchaseReceivingService {
    constructor(
        private readonly purchaseReceivingRepository: PurchaseReceivingRepository,
    ) {}

    async list(
        dto: ListPurchaseReceiptsDto,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } =
            await this.purchaseReceivingRepository.findMany({
                skip: (page - 1) * limit,
                take: limit,
                purchaseOrderId: dto.purchaseOrderId,
                purchaseRequestId: dto.purchaseRequestId,
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
        const receipt = await this.purchaseReceivingRepository.findById(id);
        if (!receipt)
            throw new NotFoundException('Purchase receipt not found.');
        return receipt;
    }

    async create(dto: CreatePurchaseReceiptDto, receivedById: string) {
        const order =
            await this.purchaseReceivingRepository.findOrderForReceiving(
                dto.purchaseOrderId,
            );
        if (!order)
            throw new BadRequestException('Purchase order does not exist.');
        if (!RECEIVABLE_ORDER_STATUSES.includes(order.status)) {
            throw new ConflictException(
                'This purchase order is not open for receiving.',
            );
        }

        const warehouse =
            await this.purchaseReceivingRepository.findWarehouseDepartment();
        if (!warehouse)
            throw new BadRequestException(
                'No Central Warehouse department is configured -- cannot receive stock.',
            );

        const lines = dto.items.map((inputItem) => {
            const orderItem = order.items.find(
                (i) => i.id === inputItem.purchaseOrderItemId,
            );
            if (!orderItem)
                throw new BadRequestException(
                    'One or more items do not belong to this purchase order.',
                );

            const remaining =
                Number(orderItem.orderedQuantity) -
                Number(orderItem.receivedQuantity);
            if (inputItem.quantity > remaining) {
                throw new BadRequestException(
                    `Received quantity exceeds what remains on the order (remaining: ${remaining}).`,
                );
            }

            return {
                purchaseOrderItemId: orderItem.id,
                purchaseRequestItemId: orderItem.purchaseRequestItemId,
                variantId: orderItem.variantId,
                expectedQuantity: remaining,
                quantity: inputItem.quantity,
                batchNumber: inputItem.batchNumber,
                manufacturingDate: inputItem.manufacturingDate
                    ? new Date(inputItem.manufacturingDate)
                    : undefined,
                expirationDate: inputItem.expirationDate
                    ? new Date(inputItem.expirationDate)
                    : undefined,
                purchasePrice: inputItem.purchasePrice,
            };
        });

        return this.purchaseReceivingRepository.receive({
            purchaseOrderId: order.id,
            purchaseRequestId: order.purchaseRequestId,
            supplierId: order.supplierId,
            warehouseDepartmentId: warehouse.id,
            receivedById,
            receivingDate: new Date(dto.receivingDate),
            notes: dto.notes,
            lines,
        });
    }
}
