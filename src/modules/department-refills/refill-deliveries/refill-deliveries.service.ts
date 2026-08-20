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
import { AlreadyProcessedError } from '../../../common/utils/concurrency.util';
import { UserScopeService } from '../../rbac/user-scope.service';
import {
    HOSPITAL_MANAGER_ROLE_NAME,
    WAREHOUSE_MANAGER_ROLE_NAME,
} from '../../../common/constants/roles.constants';
import { StockThresholdCheckService } from '../../inventory/stock-threshold-check.service';

const SHIPPABLE_STATUSES = ['preparing', 'partially_complete'];
const UNRESTRICTED_ROLES = [
    WAREHOUSE_MANAGER_ROLE_NAME,
    HOSPITAL_MANAGER_ROLE_NAME,
];
@Injectable()
export class RefillDeliveriesService {
    constructor(
        private readonly refillDeliveriesRepository: RefillDeliveriesRepository,
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
        private readonly departmentsCacheService: DepartmentsCacheService,
        private readonly userScopeService: UserScopeService,
        private readonly stockThresholdCheckService: StockThresholdCheckService,
    ) {}

    async list(
        dto: ListDeliveriesDto,
        requestingUserId: string,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const scope = await this.resolveDepartmentScope(requestingUserId);

        const { items, total } = await this.refillDeliveriesRepository.findMany(
            {
                skip: (page - 1) * limit,
                take: limit,
                refillRequestId: dto.refillRequestId,
                departmentId: scope ?? undefined,
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

    async findById(id: string, requestingUserId: string) {
        const delivery = await this.refillDeliveriesRepository.findById(id);
        if (!delivery)
            throw new NotFoundException('لم يتم العثور على عملية التسليم.');

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope) {
            const departmentId =
                await this.refillDeliveriesRepository.findDepartmentIdForDelivery(
                    id,
                );
            if (departmentId !== scope) {
                throw new ForbiddenException(
                    'يمكنك فقط عرض عمليات التسليم الخاصة بقسمك.',
                );
            }
        }

        return delivery;
    }

    private async resolveDepartmentScope(
        requestingUserId: string,
    ): Promise<string | null> {
        const scope =
            await this.userScopeService.getUserScope(requestingUserId);
        if (!scope) throw new BadRequestException('Requesting user not found.');

        if (scope.isSuperAdmin || UNRESTRICTED_ROLES.includes(scope.roleName))
            return null;
        return scope.departmentId;
    }

    async create(dto: CreateDeliveryDto, deliveredById: string) {
        const request =
            await this.refillDeliveriesRepository.findRefillRequestForDelivery(
                dto.refillRequestId,
            );
        if (!request) throw new BadRequestException('طلب التزويد غير موجود.');
        if (!SHIPPABLE_STATUSES.includes(request.status)) {
            throw new ConflictException(
                'طلب التزويد هذا ليس متاحاً للشحن حالياً.',
            );
        }

        const pendingDeliveries =
            await this.refillDeliveriesRepository.countUnconfirmedForRequest(
                dto.refillRequestId,
            );
        if (pendingDeliveries > 0) {
            throw new ConflictException(
                'طلب التزويد هذا لديه بالفعل عملية تسليم بانتظار التأكيد -- قم بتأكيدها قبل إنشاء عملية تسليم أخرى.',
            );
        }

        const warehouse =
            await this.departmentsCacheService.getByType('central_warehouse');
        if (!warehouse)
            throw new BadRequestException('لم يتم تكوين قسم المستودع المركزي.');

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
                    'عنصر واحد أو أكثر لا ينتمي إلى طلب التزويد هذا.',
                );
            if (refillItem.approvedQuantity === null) {
                throw new BadRequestException(
                    'لم يتم تعيين كمية موافق عليها لهذا العنصر بعد.',
                );
            }

            const batchStock =
                await this.refillDeliveriesRepository.findBatchStock(
                    inputItem.batchId,
                    warehouse.id,
                );
            if (!batchStock)
                throw new BadRequestException(
                    'الدفعة المختارة غير متوفرة في المستودع المركزي.',
                );
            if (batchStock.batch.variantId !== refillItem.variantId) {
                throw new BadRequestException(
                    'الدفعة المختارة لا تتطابق مع البديل المطلوب.',
                );
            }
            if (Number(batchStock.quantity) < inputItem.shippedQuantity) {
                throw new BadRequestException(
                    'الكمية غيرเพียงية في الدفعة المختارة بالمستودع.',
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
        const delivery =
            await this.refillDeliveriesRepository.findById(deliveryId);
        if (!delivery)
            throw new NotFoundException('لم يتم العثور على عملية التسليم.');
        if (delivery.confirmedAt)
            throw new ConflictException('تم تأكيد عملية التسليم هذه مسبقاً.');

        const request =
            await this.refillDeliveriesRepository.findRefillRequestForDelivery(
                delivery.refillRequestId,
            );
        if (!request)
            throw new NotFoundException(
                'لم يتم العثور على طلب التزويد المرتبط.',
            );

        if (request.requestedById !== confirmingUserId) {
            const scope =
                await this.userScopeService.getUserScope(confirmingUserId);
            const canConfirmOnBehalf =
                scope?.roleName === HOSPITAL_MANAGER_ROLE_NAME ||
                scope?.departmentId === request.departmentId;
            if (!canConfirmOnBehalf) {
                throw new ForbiddenException(
                    'فقط طالب الطلب الأصلي أو موظف آخر في القسم الطالب يمكنه تأكيد عمليات التسليم لهذا الطلب.',
                );
            }
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
                'يجب توفير الكميات المستلمة لكل عنصر في عملية التسليم هذه بدقة.',
            );
        }

        for (const confirmedItem of dto.items) {
            const deliveryItem = deliveryItems.find(
                (i) => i.id === confirmedItem.deliveryItemId,
            );
            if (!deliveryItem)
                throw new BadRequestException(
                    'عنصر واحد أو أكثر لا ينتمي إلى عملية التسليم هذه.',
                );

            confirmations.push({
                deliveryItemId: deliveryItem.id,
                refillItemId: deliveryItem.refillItemId,
                batchId: deliveryItem.batchId,
                shipped: Number(deliveryItem.shippedQuantity),
                received: confirmedItem.receivedQuantity,
            });
        }

        let result: Awaited<
            ReturnType<typeof this.refillDeliveriesRepository.confirmDelivery>
        >;
        try {
            result = await this.refillDeliveriesRepository.confirmDelivery({
                deliveryId,
                refillRequestId: request.id,
                departmentId: request.departmentId,
                confirmedById: confirmingUserId,
                notes: dto.notes,
                batchType: delivery.type,
                confirmations,
            });
        } catch (error) {
            if (error instanceof AlreadyProcessedError) {
                throw new ConflictException(
                    'This delivery has already been confirmed.',
                );
            }
            throw error;
        }

        const variantIdByRefillItemId = new Map(
            request.items.map((i) => [i.id, i.variantId]),
        );
        const affectedPairs = confirmations
            .filter((c) => c.received > 0)
            .map((c) => ({
                variantId: variantIdByRefillItemId.get(c.refillItemId),
                departmentId: request.departmentId,
            }))
            .filter(
                (p): p is { variantId: string; departmentId: string } =>
                    !!p.variantId,
            );
        await this.stockThresholdCheckService.checkAndNotifyMany(affectedPairs);

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
