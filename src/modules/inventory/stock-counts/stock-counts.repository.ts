import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { AdjustmentType, Prisma, StockCountStatus } from '@prisma/client';
import { variantInventorySelect } from '../../../common/selects/variant.select';
import { InventoryLedgerService } from '../transactions/inventory-ledger.service';
import { InsufficientStockError } from '../../../common/utils/fefo.util';
import { AlreadyProcessedError } from '../../../common/utils/concurrency.util';

const sessionDetailSelect = {
    id: true,
    departmentId: true,
    department: { select: { id: true, name: true, type: true } },
    initiatedById: true,
    initiatedBy: { select: { id: true, fullName: true } },
    status: true,
    countDate: true,
    completedAt: true,
    notes: true,
    createdAt: true,
    items: {
        select: {
            id: true,
            variantId: true,
            batchId: true,
            expectedQuantity: true,
            countedQuantity: true,
            variance: true,
            notes: true,
            variant: { select: variantInventorySelect },
            batch: { select: { id: true, batchNumber: true } },
        },
    },
} satisfies Prisma.StockCountSessionSelect;

const sessionListSelect = {
    id: true,
    departmentId: true,
    department: { select: { id: true, name: true } },
    status: true,
    countDate: true,
    completedAt: true,
    createdAt: true,
} satisfies Prisma.StockCountSessionSelect;

@Injectable()
export class StockCountsRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly inventoryLedger: InventoryLedgerService,
    ) {}
    async findMany(params: {
        skip: number;
        take: number;
        departmentId?: string;
        status?: StockCountStatus;
    }) {
        const where: Prisma.StockCountSessionWhereInput = {
            departmentId: params.departmentId,
            status: params.status,
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.stockCountSession.findMany({
                where,
                select: sessionListSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.stockCountSession.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.stockCountSession.findUnique({
            where: { id },
            select: sessionDetailSelect,
        });
    }

    findVariant(id: string) {
        return this.prisma.productVariant.findUnique({
            where: { id },
            select: { id: true, isActive: true },
        });
    }

    findBatch(id: string) {
        return this.prisma.batch.findUnique({
            where: { id },
            select: { id: true, variantId: true },
        });
    }

    getLiveBatchQuantity(batchId: string, departmentId: string) {
        return this.prisma.batchStock.findUnique({
            where: { batchId_departmentId: { batchId, departmentId } },
            select: { quantity: true },
        });
    }

    findActiveDraftForDepartment(departmentId: string) {
        return this.prisma.stockCountSession.findFirst({
            where: { departmentId, status: 'draft' },
            select: { id: true, countDate: true, createdAt: true },
        });
    }

    async createSession(data: {
        departmentId: string;
        initiatedById: string;
        countDate: Date;
        notes?: string;
    }) {
        return this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('stock_count_session:' || ${data.departmentId}))`;

            const existingDraft = await tx.stockCountSession.findFirst({
                where: { departmentId: data.departmentId, status: 'draft' },
                select: { id: true },
            });
            if (existingDraft) {
                throw new AlreadyProcessedError(
                    'This department already has a draft stock count in progress -- complete or cancel it before starting a new one.',
                );
            }

            return tx.stockCountSession.create({
                data,
                select: sessionDetailSelect,
            });
        });
    }

    async deleteDraft(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const locked = await tx.$queryRaw<{ status: string }[]>`
                SELECT status::text AS status
                FROM stock_count_sessions
                WHERE id = ${id}::uuid
                FOR UPDATE
            `;
            if (locked.length === 0) {
                throw new AlreadyProcessedError(
                    'This stock count no longer exists.',
                );
            }
            if (locked[0].status !== 'draft') {
                throw new AlreadyProcessedError(
                    'This stock count is no longer a draft -- it may have already been completed.',
                );
            }

            await tx.stockCountItem.deleteMany({ where: { sessionId: id } });
            await tx.stockCountSession.delete({ where: { id } });
        });
    }

    addItem(data: {
        sessionId: string;
        variantId: string;
        batchId: string;
        expectedQuantity: number;
        countedQuantity: number;
        notes?: string;
    }) {
        return this.prisma.stockCountItem.create({
            data: {
                sessionId: data.sessionId,
                variantId: data.variantId,
                batchId: data.batchId,
                expectedQuantity: data.expectedQuantity,
                countedQuantity: data.countedQuantity,
                variance: data.countedQuantity - data.expectedQuantity,
                notes: data.notes,
            },
        });
    }

    findItemById(id: string) {
        return this.prisma.stockCountItem.findUnique({ where: { id } });
    }

    updateItem(
        id: string,
        countedQuantity: number,
        expectedQuantity: number,
        notes?: string,
    ) {
        return this.prisma.stockCountItem.update({
            where: { id },
            data: {
                countedQuantity,
                variance: countedQuantity - expectedQuantity,
                notes,
            },
        });
    }

    countItems(sessionId: string) {
        return this.prisma.stockCountItem.count({ where: { sessionId } });
    }

    completeSession(id: string, performedById: string) {
        return this.prisma.$transaction(async (tx) => {
            const claimed = await tx.stockCountSession.updateMany({
                where: { id, status: 'draft' },
                data: { status: 'completed', completedAt: new Date() },
            });
            if (claimed.count === 0) {
                throw new AlreadyProcessedError(
                    'This stock count has already been completed.',
                );
            }

            const session = await tx.stockCountSession.findUniqueOrThrow({
                where: { id },
                select: { departmentId: true },
            });

            const items = await tx.stockCountItem.findMany({
                where: { sessionId: id },
            });

            for (const item of items) {
                const variance = Number(item.variance);
                if (variance === 0 || !item.batchId) continue;

                const adjustmentType: AdjustmentType =
                    variance > 0 ? 'found' : 'shrinkage';
                const quantity = Math.abs(variance);

                await tx.inventoryAdjustment.create({
                    data: {
                        variantId: item.variantId,
                        departmentId: session.departmentId,
                        batchId: item.batchId,
                        adjustmentType,
                        quantity,
                        notes: 'Auto-generated from stock count variance.',
                        reportedById: performedById,
                        referenceType: 'stock_count',
                        referenceId: id,
                    },
                });

                let balanceAfter: number;

                if (variance > 0) {
                    const updatedStock = await tx.batchStock.upsert({
                        where: {
                            batchId_departmentId: {
                                batchId: item.batchId,
                                departmentId: session.departmentId,
                            },
                        },
                        update: { quantity: { increment: quantity } },
                        create: {
                            batchId: item.batchId,
                            departmentId: session.departmentId,
                            quantity,
                        },
                    });
                    balanceAfter = Number(updatedStock.quantity);
                } else {
                    const updated = await tx.$queryRaw<{ quantity: number }[]>`
                        UPDATE batch_stock
                        SET quantity = quantity - ${quantity}
                        WHERE batch_id = ${item.batchId}::uuid
                          AND department_id = ${session.departmentId}::uuid
                          AND quantity >= ${quantity}
                        RETURNING quantity::float AS "quantity"
                    `;
                    if (updated.length === 0) {
                        throw new InsufficientStockError(quantity);
                    }
                    balanceAfter = updated[0].quantity;
                }

                await this.inventoryLedger.record(tx, {
                    transactionType:
                        variance > 0
                            ? 'adjustment_found'
                            : 'adjustment_shrinkage',
                    variantId: item.variantId,
                    batchId: item.batchId,
                    departmentId: session.departmentId,
                    quantity: variance > 0 ? quantity : -quantity,
                    balanceAfter,
                    referenceType: 'stock_count',
                    referenceId: id,
                    performedById,
                });
            }

            return tx.stockCountSession.findUniqueOrThrow({
                where: { id },
                select: sessionDetailSelect,
            });
        });
    }
}
