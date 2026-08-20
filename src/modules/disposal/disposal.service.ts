import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { DisposalRepository } from './disposal.repository';
import { DepartmentsCacheService } from '../departments/departments-cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_TYPES } from '../../common/constants/notification-types.constants';
import { AlreadyProcessedError } from '../../common/utils/concurrency.util';
import { ListDisposalTransfersDto } from './dto/list-disposal-transfers.dto';
import { ConfirmDisposalTransferDto } from './dto/confirm-disposal-transfer.dto';
import { CancelDisposalTransferDto } from './dto/cancel-disposal-transfer.dto';
import { PaginatedResult } from '../../core/interfaces/paginated-result.interface';
import { StockThresholdCheckService } from '../inventory/stock-threshold-check.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class DisposalService {
    constructor(
        private readonly disposalRepository: DisposalRepository,
        private readonly departmentsCacheService: DepartmentsCacheService,
        private readonly notificationsService: NotificationsService,
        private readonly stockThresholdCheckService: StockThresholdCheckService,
    ) {}

    async getCandidates(departmentId: string) {
        const department =
            await this.departmentsCacheService.getById(departmentId);
        if (!department) throw new BadRequestException('القسم غير موجود.');

        const [adjustments, nearExpiryRows] = await Promise.all([
            this.disposalRepository.findEligibleAdjustments(departmentId),
            this.disposalRepository.findEligibleNearExpiryBatches(departmentId),
        ]);

        const damaged = adjustments.filter(
            (a) => a.adjustmentType === 'damaged',
        );
        const expired = adjustments.filter(
            (a) => a.adjustmentType === 'expired',
        );

        const now = Date.now();
        const nearExpiry = nearExpiryRows.map((row) => ({
            batchId: row.batchId,
            batchNumber: row.batchNumber,
            variantId: row.variantId,
            variantName: row.variantName,
            sku: row.sku,
            quantity: row.quantity,
            expirationDate: row.expirationDate,
            allowedDays: row.allowedDays,
            daysRemaining: Math.floor(
                (new Date(row.expirationDate).getTime() - now) / MS_PER_DAY,
            ),
        }));

        return { damaged, expired, nearExpiry };
    }

    async list(
        dto: ListDisposalTransfersDto,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } = await this.disposalRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            departmentId: dto.departmentId,
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
        const transfer = await this.disposalRepository.findById(id);
        if (!transfer)
            throw new NotFoundException('عملية نقل الهالك غير موجودة.');
        return transfer;
    }

    async initiate(departmentId: string, initiatedById: string) {
        const department =
            await this.departmentsCacheService.getById(departmentId);
        if (!department) throw new BadRequestException('القسم غير موجود.');
        if (!department.isActive)
            throw new BadRequestException('القسم غير نشط.');
        if (!department.tracksInventory) {
            throw new BadRequestException('هذا القسم لا يتتبع المخزون.');
        }
        if (department.type === 'disposal_warehouse') {
            throw new BadRequestException(
                'لا يمكن لمستودع الهالك بدء عملية نقل هالك إلى نفسه.',
            );
        }

        const transfer = await this.disposalRepository.initiateTransfer({
            departmentId,
            initiatedById,
        });

        await this.notifyDepartmentManager(departmentId, {
            type: NOTIFICATION_TYPES.DISPOSAL_TRANSFER_INITIATED,
            title: 'تم بدء نقل الهالك',
            body: 'تم بدء نقل هالك لقسمك -- يتم جمع العناصر التالفة، ومنتهية الصلاحية، وقريبة من انتهاء الصلاحية لمستودع الهالك.',
            data: { disposalTransferId: transfer.id, departmentId },
        });

        return transfer;
    }

    async confirm(
        id: string,
        dto: ConfirmDisposalTransferDto,
        confirmingUserId: string,
    ) {
        const transfer = await this.findById(id);
        if (transfer.status !== 'initiated') {
            throw new ConflictException(
                'يمكن فقط تأكيد النقل الذي ينتظر التأكيد.',
            );
        }

        const itemIds = new Set(transfer.items.map((i) => i.id));
        const dtoItemIds = new Set(
            dto.items.map((i) => i.disposalTransferItemId),
        );
        if (
            itemIds.size !== dtoItemIds.size ||
            ![...itemIds].every((itemId) => dtoItemIds.has(itemId))
        ) {
            throw new BadRequestException(
                'يجب توفير الكميات المؤكدة لكل عنصر في عملية النقل هذه حصراً.',
            );
        }

        const confirmations = dto.items.map((confirmedItem) => {
            const item = transfer.items.find(
                (i) => i.id === confirmedItem.disposalTransferItemId,
            );
            if (!item) {
                throw new BadRequestException(
                    'عنصر واحد أو أكثر لا ينتمي إلى عملية النقل هذه.',
                );
            }
            if (
                confirmedItem.confirmedQuantity > Number(item.shippedQuantity)
            ) {
                throw new BadRequestException(
                    'لا يمكن أن تتجاوز الكمية المؤكدة الكمية المشحونة.',
                );
            }
            return {
                itemId: item.id,
                variantId: item.variantId,
                batchId: item.batchId,
                shippedQuantity: Number(item.shippedQuantity),
                confirmedQuantity: confirmedItem.confirmedQuantity,
            };
        });

        const warehouse =
            await this.departmentsCacheService.getByType('disposal_warehouse');
        if (!warehouse) {
            throw new BadRequestException('لم يتم تكوين قسم مستودع الهالك.');
        }

        let result: Awaited<
            ReturnType<typeof this.disposalRepository.confirmTransfer>
        >;
        try {
            result = await this.disposalRepository.confirmTransfer({
                transferId: id,
                disposalWarehouseId: warehouse.id,
                confirmedById: confirmingUserId,
                notes: dto.notes,
                confirmations,
            });
        } catch (error) {
            if (error instanceof AlreadyProcessedError) {
                throw new ConflictException(error.message);
            }
            throw error;
        }

        // Confirmed quantities land in the disposal warehouse -- check its
        // stock levels for every affected variant right away instead of
        // waiting for the daily threshold cron.
        await this.stockThresholdCheckService.checkAndNotifyMany(
            confirmations
                .filter((c) => c.confirmedQuantity > 0)
                .map((c) => ({
                    variantId: c.variantId,
                    departmentId: warehouse.id,
                })),
        );

        return result;
    }

    async cancel(
        id: string,
        dto: CancelDisposalTransferDto,
        cancellingUserId: string,
    ) {
        const transfer = await this.findById(id);
        if (transfer.status !== 'initiated') {
            throw new ConflictException(
                'يمكن فقط إلغاء النقل الذي ينتظر التأكيد.',
            );
        }

        try {
            const cancelled = await this.disposalRepository.cancelTransfer({
                transferId: id,
                cancelledById: cancellingUserId,
                reason: dto.reason,
            });

            // cancelTransfer restores stock only for the 'near_expiry' items
            // it had already deducted at initiation time, and it restores
            // them into the transfer's originating department -- check that
            // department's thresholds for those variants now.
            await this.stockThresholdCheckService.checkAndNotifyMany(
                transfer.items
                    .filter((i) => i.sourceType === 'near_expiry')
                    .map((i) => ({
                        variantId: i.variantId,
                        departmentId: transfer.departmentId,
                    })),
            );

            await this.notifyDepartmentManager(transfer.departmentId, {
                type: NOTIFICATION_TYPES.DISPOSAL_TRANSFER_CANCELLED,
                title: 'تم إلغاء نقل الهالك',
                body: 'تم إلغاء نقل الهالك لقسمك -- أي عناصر قريبة من انتهاء الصلاحية تم سحبها قد تمت إعادتها إلى مخزونك الحي.',
                data: {
                    disposalTransferId: id,
                    departmentId: transfer.departmentId,
                },
            });

            return cancelled;
        } catch (error) {
            if (error instanceof AlreadyProcessedError) {
                throw new ConflictException(error.message);
            }
            throw error;
        }
    }

    private async notifyDepartmentManager(
        departmentId: string,
        payload: {
            type: string;
            title: string;
            body: string;
            data: Record<string, unknown>;
        },
    ) {
        const department =
            await this.disposalRepository.findDepartmentManagerId(departmentId);
        if (!department?.managerId) return;

        await this.notificationsService.create({
            userId: department.managerId,
            type: payload.type,
            category: 'inventory',
            title: payload.title,
            body: payload.body,
            data: payload.data,
        });
    }
}
