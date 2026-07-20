import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { RefillDeliveriesRepository } from './refill-deliveries.repository';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';
import { ListDeliveriesDto } from './dto/list-deliveries.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NOTIFICATION_TYPES } from '../../../common/constants/notification-types.constants';
const SHIPPABLE_STATUSES = ['ready_for_delivery', 'partially_delivered'];

@Injectable()
export class RefillDeliveriesService {
    constructor(
        private readonly refillDeliveriesRepository: RefillDeliveriesRepository,
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
    ) {}

    async list(dto: ListDeliveriesDto): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } = await this.refillDeliveriesRepository.findMany(
            {
                skip: (page - 1) * limit,
                take: limit,
                refillRequestId: dto.refillRequestId,
            },
        );

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findById(id: string) {
        const delivery = await this.refillDeliveriesRepository.findById(id);
        if (!delivery) throw new NotFoundException('Delivery not found.');
        return delivery;
    }

    async create(dto: CreateDeliveryDto, deliveredById: string) {
        const request =
            await this.refillDeliveriesRepository.findRefillRequestForDelivery(
                dto.refillRequestId,
            );
        if (!request)
            throw new BadRequestException('Refill request does not exist.');
        if (!SHIPPABLE_STATUSES.includes(request.status)) {
            throw new ConflictException(
                'This refill request is not open for shipment.',
            );
        }

        const warehouse =
            await this.refillDeliveriesRepository.findWarehouseDepartment();
        if (!warehouse)
            throw new BadRequestException(
                'No Central Warehouse department is configured.',
            );

        const lines: {
            refillItemId: string;
            batchId: string;
            shippedQuantity: number;
        }[] = [];

        for (const inputItem of dto.items) {
            const refillItem = request.items.find(
                (i) => i.id === inputItem.refillItemId,
            );
            if (!refillItem)
                throw new BadRequestException(
                    'One or more items do not belong to this refill request.',
                );
            if (refillItem.preparedQuantity === null) {
                throw new BadRequestException(
                    'This item has not been assigned a prepared quantity yet.',
                );
            }

            const alreadyShipped =
                await this.refillDeliveriesRepository.sumShippedForRefillItem(
                    refillItem.id,
                );
            const remaining =
                Number(refillItem.preparedQuantity) -
                Number(alreadyShipped._sum.shippedQuantity ?? 0);
            if (inputItem.shippedQuantity > remaining) {
                throw new BadRequestException(
                    `Shipped quantity exceeds what remains prepared (remaining: ${remaining}).`,
                );
            }

            const batchStock =
                await this.refillDeliveriesRepository.findBatchStock(
                    inputItem.batchId,
                    warehouse.id,
                );
            if (!batchStock)
                throw new BadRequestException(
                    'Selected batch is not stocked at the Central Warehouse.',
                );
            if (batchStock.batch.variantId !== refillItem.variantId) {
                throw new BadRequestException(
                    'Selected batch does not match the requested variant.',
                );
            }
            if (Number(batchStock.quantity) < inputItem.shippedQuantity) {
                throw new BadRequestException(
                    'Insufficient stock in the selected batch at the warehouse.',
                );
            }

            lines.push({
                refillItemId: refillItem.id,
                batchId: inputItem.batchId,
                shippedQuantity: inputItem.shippedQuantity,
            });
        }

        return this.refillDeliveriesRepository.createDelivery({
            refillRequestId: dto.refillRequestId,
            deliveredById,
            warehouseDepartmentId: warehouse.id,
            notes: dto.notes,
            lines,
        });
    }

    async confirm(
        deliveryId: string,
        dto: ConfirmDeliveryDto,
        confirmerId: string,
        requestingUserId: string,
    ) {
        const delivery = await this.findById(deliveryId);
        if (delivery.confirmedAt)
            throw new ConflictException(
                'This delivery has already been confirmed.',
            );

        const request =
            await this.refillDeliveriesRepository.findRefillRequestForDelivery(
                delivery.refillRequestId,
            );
        if (!request)
            throw new NotFoundException('Associated refill request not found.');

        await this.assertDepartmentScope(
            requestingUserId,
            request.departmentId,
        );

        const deliveryItems =
            await this.refillDeliveriesRepository.findDeliveryItemsForConfirm(
                deliveryId,
            );
        const confirmations: {
            deliveryItemId: string;
            refillItemId: string;
            batchId: string;
            shipped: number;
            received: number;
        }[] = [];

        const itemIds = new Set(deliveryItems.map((i) => i.id));
        const dtoItemIds = new Set(dto.items.map((i) => i.deliveryItemId));
        if (
            itemIds.size !== dtoItemIds.size ||
            ![...itemIds].every((id) => dtoItemIds.has(id))
        ) {
            throw new BadRequestException(
                'Received quantities must be provided for exactly every item on this delivery.',
            );
        }

        for (const confirmedItem of dto.items) {
            const deliveryItem = deliveryItems.find(
                (i) => i.id === confirmedItem.deliveryItemId,
            );
            if (!deliveryItem)
                throw new BadRequestException(
                    'One or more items do not belong to this delivery.',
                );
            if (
                confirmedItem.receivedQuantity >
                Number(deliveryItem.shippedQuantity)
            ) {
                throw new BadRequestException(
                    'Received quantity cannot exceed shipped quantity.',
                );
            }

            confirmations.push({
                deliveryItemId: deliveryItem.id,
                refillItemId: deliveryItem.refillItemId,
                batchId: deliveryItem.batchId,
                shipped: Number(deliveryItem.shippedQuantity),
                received: confirmedItem.receivedQuantity,
            });
        }
        const result = await this.refillDeliveriesRepository.confirmDelivery({
            deliveryId,
            refillRequestId: request.id,
            departmentId: request.departmentId,
            confirmedById: confirmerId,
            notes: dto.notes,
            confirmations,
        });

        const updatedRequest =
            await this.prisma.departmentRefillRequest.findUniqueOrThrow({
                where: { id: request.id },
                select: {
                    id: true,
                    requestNumber: true,
                    requestedById: true,
                    status: true,
                },
            });
        await this.notificationsService.create({
            userId: updatedRequest.requestedById,
            type: NOTIFICATION_TYPES.REFILL_REQUEST_STATUS_CHANGED,
            category: 'inventory',
            title: 'Refill request status updated',
            body: `Refill request ${updatedRequest.requestNumber} is now "${updatedRequest.status}".`,
            data: {
                refillRequestId: updatedRequest.id,
                status: updatedRequest.status,
            },
        });

        return result;
    }

    private async assertDepartmentScope(
        requestingUserId: string,
        targetDepartmentId: string,
    ) {
        const user = await this.prisma.user.findUnique({
            where: { id: requestingUserId },
            select: { departmentId: true, role: { select: { name: true } } },
        });
        if (!user) throw new BadRequestException('Requesting user not found.');

        const unrestrictedRoles = ['hospital_manager', 'warehouse_manager'];
        if (unrestrictedRoles.includes(user.role.name)) return;

        if (user.departmentId !== targetDepartmentId) {
            throw new ForbiddenException(
                'You can only confirm deliveries for your own department.',
            );
        }
    }
}
