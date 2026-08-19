import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, DisposalTransferStatus } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { InventoryLedgerService } from '../inventory/transactions/inventory-ledger.service';
import { AlreadyProcessedError } from '../../common/utils/concurrency.util';
import { variantMinimalSelect } from '../../common/selects/variant.select';

export interface NearExpiryCandidateRow {
    batchId: string;
    batchNumber: string;
    expirationDate: Date;
    quantity: number;
    variantId: string;
    variantName: string;
    sku: string;
    allowedDays: number;
}

const disposalTransferDetailSelect = {
    id: true,
    departmentId: true,
    department: { select: { id: true, name: true, type: true } },
    status: true,
    initiatedById: true,
    initiatedBy: { select: { id: true, fullName: true } },
    initiatedAt: true,
    confirmedById: true,
    confirmedBy: { select: { id: true, fullName: true } },
    confirmedAt: true,
    cancelledById: true,
    cancelledBy: { select: { id: true, fullName: true } },
    cancelledAt: true,
    cancelReason: true,
    notes: true,
    items: {
        select: {
            id: true,
            sourceType: true,
            adjustmentId: true,
            variantId: true,
            batchId: true,
            shippedQuantity: true,
            confirmedQuantity: true,
            quantityDiscrepancy: true,
            variant: { select: variantMinimalSelect },
            batch: {
                select: { id: true, batchNumber: true, expirationDate: true },
            },
        },
    },
} satisfies Prisma.DisposalTransferSelect;

const disposalTransferListSelect = {
    id: true,
    departmentId: true,
    department: { select: { id: true, name: true } },
    status: true,
    initiatedAt: true,
    confirmedAt: true,
} satisfies Prisma.DisposalTransferSelect;

@Injectable()
export class DisposalRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly inventoryLedger: InventoryLedgerService,
    ) {}

    async findMany(params: {
        skip: number;
        take: number;
        departmentId?: string;
        status?: DisposalTransferStatus;
    }) {
        const where: Prisma.DisposalTransferWhereInput = {
            departmentId: params.departmentId,
            status: params.status,
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.disposalTransfer.findMany({
                where,
                select: disposalTransferListSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { initiatedAt: 'desc' },
            }),
            this.prisma.disposalTransfer.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.disposalTransfer.findUnique({
            where: { id },
            select: disposalTransferDetailSelect,
        });
    }

    findDepartmentManagerId(departmentId: string) {
        return this.prisma.department.findUnique({
            where: { id: departmentId },
            select: { managerId: true },
        });
    }

    findEligibleAdjustments(departmentId: string) {
        return this.prisma.inventoryAdjustment.findMany({
            where: {
                departmentId,
                adjustmentType: { in: ['damaged', 'expired'] },
                disposalTransferItems: {
                    none: { transfer: { status: { not: 'cancelled' } } },
                },
            },
            select: {
                id: true,
                adjustmentType: true,
                quantity: true,
                createdAt: true,
                variant: { select: variantMinimalSelect },
                batch: {
                    select: {
                        id: true,
                        batchNumber: true,
                        expirationDate: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    findEligibleNearExpiryBatches(
        departmentId: string,
    ): Promise<NearExpiryCandidateRow[]> {
        return this.prisma.$queryRaw<NearExpiryCandidateRow[]>`
            SELECT
                bs.batch_id AS "batchId",
                b.batch_number AS "batchNumber",
                b.expiration_date AS "expirationDate",
                bs.quantity::float AS "quantity",
                pv.id AS "variantId",
                pv.variant_name AS "variantName",
                pv.sku AS "sku",
                p.near_expiry_disposal_days AS "allowedDays"
            FROM batch_stock bs
            JOIN batches b ON b.id = bs.batch_id
            JOIN product_variants pv ON pv.id = b.variant_id
            JOIN products p ON p.id = pv.product_id
            WHERE bs.department_id = ${departmentId}::uuid
              AND bs.quantity > 0
              AND p.near_expiry_disposal_days IS NOT NULL
              AND b.expiration_date <= (now()::date + (p.near_expiry_disposal_days || ' days')::interval)
            ORDER BY b.expiration_date ASC
        `;
    }

    async initiateTransfer(params: {
        departmentId: string;
        initiatedById: string;
    }) {
        return this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('disposal_transfer:' || ${params.departmentId}))`;

            const eligibleAdjustments = await tx.inventoryAdjustment.findMany({
                where: {
                    departmentId: params.departmentId,
                    adjustmentType: { in: ['damaged', 'expired'] },
                    disposalTransferItems: {
                        none: { transfer: { status: { not: 'cancelled' } } },
                    },
                },
                select: {
                    id: true,
                    variantId: true,
                    batchId: true,
                    quantity: true,
                },
            });

            const nearExpiryRows = await tx.$queryRaw<
                {
                    batchId: string;
                    variantId: string;
                }[]
            >`
                SELECT bs.batch_id AS "batchId", b.variant_id AS "variantId"
                FROM batch_stock bs
                JOIN batches b ON b.id = bs.batch_id
                JOIN product_variants pv ON pv.id = b.variant_id
                JOIN products p ON p.id = pv.product_id
                WHERE bs.department_id = ${params.departmentId}::uuid
                  AND bs.quantity > 0
                  AND p.near_expiry_disposal_days IS NOT NULL
                  AND b.expiration_date <= (now()::date + (p.near_expiry_disposal_days || ' days')::interval)
            `;

            if (
                eligibleAdjustments.length === 0 &&
                nearExpiryRows.length === 0
            ) {
                throw new BadRequestException(
                    'لا يوجد أي عناصر مؤهلة للتخلص منها في هذا القسم حالياً.',
                );
            }

            const transfer = await tx.disposalTransfer.create({
                data: {
                    departmentId: params.departmentId,
                    initiatedById: params.initiatedById,
                },
            });

            let itemsCreated = 0;

            for (const adj of eligibleAdjustments) {
                await tx.disposalTransferItem.create({
                    data: {
                        transferId: transfer.id,
                        sourceType: 'adjustment',
                        adjustmentId: adj.id,
                        variantId: adj.variantId,
                        batchId: adj.batchId,
                        shippedQuantity: adj.quantity,
                    },
                });
                itemsCreated++;
            }

            for (const row of nearExpiryRows) {
                const locked = await tx.$queryRaw<{ quantity: number }[]>`
                    SELECT quantity::float AS "quantity"
                    FROM batch_stock
                    WHERE batch_id = ${row.batchId}::uuid
                      AND department_id = ${params.departmentId}::uuid
                    FOR UPDATE
                `;
                const liveQuantity = locked[0]?.quantity ?? 0;
                if (liveQuantity <= 0) continue;

                await tx.$executeRaw`
                    UPDATE batch_stock
                    SET quantity = 0
                    WHERE batch_id = ${row.batchId}::uuid
                      AND department_id = ${params.departmentId}::uuid
                `;

                await tx.disposalTransferItem.create({
                    data: {
                        transferId: transfer.id,
                        sourceType: 'near_expiry',
                        variantId: row.variantId,
                        batchId: row.batchId,
                        shippedQuantity: liveQuantity,
                    },
                });

                await this.inventoryLedger.record(tx, {
                    transactionType: 'disposal_transfer_out',
                    variantId: row.variantId,
                    batchId: row.batchId,
                    departmentId: params.departmentId,
                    quantity: -liveQuantity,
                    balanceAfter: 0,
                    referenceType: 'disposal_transfer',
                    referenceId: transfer.id,
                    performedById: params.initiatedById,
                });
                itemsCreated++;
            }

            if (itemsCreated === 0) {
                throw new BadRequestException(
                    'لا يوجد أي عناصر مؤهلة للتخلص منها في هذا القسم حالياً.',
                );
            }

            return tx.disposalTransfer.findUniqueOrThrow({
                where: { id: transfer.id },
                select: disposalTransferDetailSelect,
            });
        });
    }

    async confirmTransfer(params: {
        transferId: string;
        disposalWarehouseId: string;
        confirmedById: string;
        notes?: string;
        confirmations: {
            itemId: string;
            variantId: string;
            batchId: string;
            shippedQuantity: number;
            confirmedQuantity: number;
        }[];
    }) {
        return this.prisma.$transaction(async (tx) => {
            const claimed = await tx.disposalTransfer.updateMany({
                where: { id: params.transferId, status: 'initiated' },
                data: {
                    status: 'confirmed',
                    confirmedById: params.confirmedById,
                    confirmedAt: new Date(),
                    notes: params.notes,
                },
            });
            if (claimed.count === 0) {
                throw new AlreadyProcessedError(
                    'تم تأكيد نقل الهالك هذا أو إلغاؤه مسبقاً.',
                );
            }

            for (const c of params.confirmations) {
                await tx.disposalTransferItem.update({
                    where: { id: c.itemId },
                    data: {
                        confirmedQuantity: c.confirmedQuantity,
                        quantityDiscrepancy:
                            c.shippedQuantity - c.confirmedQuantity,
                    },
                });

                if (c.confirmedQuantity <= 0) continue;

                const updatedStock = await tx.batchStock.upsert({
                    where: {
                        batchId_departmentId: {
                            batchId: c.batchId,
                            departmentId: params.disposalWarehouseId,
                        },
                    },
                    update: { quantity: { increment: c.confirmedQuantity } },
                    create: {
                        batchId: c.batchId,
                        departmentId: params.disposalWarehouseId,
                        quantity: c.confirmedQuantity,
                    },
                });

                await this.inventoryLedger.record(tx, {
                    transactionType: 'disposal_transfer_in',
                    variantId: c.variantId,
                    batchId: c.batchId,
                    departmentId: params.disposalWarehouseId,
                    quantity: c.confirmedQuantity,
                    balanceAfter: Number(updatedStock.quantity),
                    referenceType: 'disposal_transfer',
                    referenceId: params.transferId,
                    performedById: params.confirmedById,
                });
            }

            return tx.disposalTransfer.findUniqueOrThrow({
                where: { id: params.transferId },
                select: disposalTransferDetailSelect,
            });
        });
    }

    async cancelTransfer(params: {
        transferId: string;
        cancelledById: string;
        reason?: string;
    }) {
        return this.prisma.$transaction(async (tx) => {
            const claimed = await tx.disposalTransfer.updateMany({
                where: { id: params.transferId, status: 'initiated' },
                data: {
                    status: 'cancelled',
                    cancelledById: params.cancelledById,
                    cancelledAt: new Date(),
                    cancelReason: params.reason,
                },
            });
            if (claimed.count === 0) {
                throw new AlreadyProcessedError(
                    'This disposal transfer has already been confirmed or cancelled.',
                );
            }

            const transfer = await tx.disposalTransfer.findUniqueOrThrow({
                where: { id: params.transferId },
                select: {
                    departmentId: true,
                    items: {
                        where: { sourceType: 'near_expiry' },
                        select: {
                            variantId: true,
                            batchId: true,
                            shippedQuantity: true,
                        },
                    },
                },
            });

            for (const item of transfer.items) {
                const updatedStock = await tx.batchStock.upsert({
                    where: {
                        batchId_departmentId: {
                            batchId: item.batchId,
                            departmentId: transfer.departmentId,
                        },
                    },
                    update: { quantity: { increment: item.shippedQuantity } },
                    create: {
                        batchId: item.batchId,
                        departmentId: transfer.departmentId,
                        quantity: item.shippedQuantity,
                    },
                });

                await this.inventoryLedger.record(tx, {
                    transactionType: 'disposal_transfer_in',
                    variantId: item.variantId,
                    batchId: item.batchId,
                    departmentId: transfer.departmentId,
                    quantity: Number(item.shippedQuantity),
                    balanceAfter: Number(updatedStock.quantity),
                    referenceType: 'disposal_transfer',
                    referenceId: params.transferId,
                    performedById: params.cancelledById,
                });
            }

            return tx.disposalTransfer.findUniqueOrThrow({
                where: { id: params.transferId },
                select: disposalTransferDetailSelect,
            });
        });
    }
}
