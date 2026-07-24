import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { RefillDeliveriesRepository } from './refill-deliveries.repository';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { DepartmentsCacheService } from '../../departments/departments-cache.service';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { InsufficientStockError } from '../../../common/utils/fefo.util';
import { NOTIFICATION_TYPES } from '../../../common/constants/notification-types.constants';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';
import { ListDeliveriesDto } from './dto/list-deliveries.dto';

const SHIPPABLE_STATUSES = ['preparing', 'partially_complete'];

@Injectable()
export class RefillDeliveriesService {
    constructor(
        private readonly refillDeliveriesRepository: RefillDeliveriesRepository,
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
        private readonly departmentsCacheService: DepartmentsCacheService,
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
            await this.departmentsCacheService.getByType('central_warehouse');
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
            if (refillItem.approvedQuantity === null) {
                throw new BadRequestException(
                    'This item has not been assigned an approved quantity yet.',
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

        try {
            return await this.refillDeliveriesRepository.createDelivery({
                refillRequestId: dto.refillRequestId,
                deliveredById,
                warehouseDepartmentId: warehouse.id,
                type: dto.type ?? 'batch',
                notes: dto.notes,
                lines,
            });
        } catch (error) {
            if (error instanceof InsufficientStockError) {
                throw new BadRequestException(
                    'Insufficient warehouse stock in one or more selected batches.',
                );
            }
            throw error;
        }
    }

    async confirm(
        deliveryId: string,
        dto: ConfirmDeliveryDto,
        confirmingUserId: string,
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

        if (request.requestedById !== confirmingUserId) {
            throw new ForbiddenException(
                'Only the department manager who created this refill request can confirm deliveries against it.',
            );
        }

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
            confirmedById: confirmingUserId,
            notes: dto.notes,
            batchType: delivery.type,
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
}
