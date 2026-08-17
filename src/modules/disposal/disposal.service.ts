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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class DisposalService {
    constructor(
        private readonly disposalRepository: DisposalRepository,
        private readonly departmentsCacheService: DepartmentsCacheService,
        private readonly notificationsService: NotificationsService,
    ) {}

    async getCandidates(departmentId: string) {
        const department =
            await this.departmentsCacheService.getById(departmentId);
        if (!department)
            throw new BadRequestException('Department does not exist.');

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
            throw new NotFoundException('Disposal transfer not found.');
        return transfer;
    }

    async initiate(departmentId: string, initiatedById: string) {
        const department =
            await this.departmentsCacheService.getById(departmentId);
        if (!department)
            throw new BadRequestException('Department does not exist.');
        if (!department.isActive)
            throw new BadRequestException('Department is inactive.');
        if (!department.tracksInventory) {
            throw new BadRequestException(
                'This department does not track inventory.',
            );
        }
        if (department.type === 'disposal_warehouse') {
            throw new BadRequestException(
                'The Disposal Warehouse cannot initiate a disposal transfer against itself.',
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
                'Only a transfer awaiting confirmation can be confirmed.',
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
                'Confirmed quantities must be provided for exactly every item on this transfer.',
            );
        }

        const confirmations = dto.items.map((confirmedItem) => {
            const item = transfer.items.find(
                (i) => i.id === confirmedItem.disposalTransferItemId,
            );
            if (!item) {
                throw new BadRequestException(
                    'One or more items do not belong to this transfer.',
                );
            }
            if (
                confirmedItem.confirmedQuantity > Number(item.shippedQuantity)
            ) {
                throw new BadRequestException(
                    'Confirmed quantity cannot exceed the shipped quantity.',
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
            throw new BadRequestException(
                'No Disposal Warehouse department is configured.',
            );
        }

        try {
            return await this.disposalRepository.confirmTransfer({
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
    }

    async cancel(
        id: string,
        dto: CancelDisposalTransferDto,
        cancellingUserId: string,
    ) {
        const transfer = await this.findById(id);
        if (transfer.status !== 'initiated') {
            throw new ConflictException(
                'Only a transfer awaiting confirmation can be cancelled.',
            );
        }

        try {
            const cancelled = await this.disposalRepository.cancelTransfer({
                transferId: id,
                cancelledById: cancellingUserId,
                reason: dto.reason,
            });

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
