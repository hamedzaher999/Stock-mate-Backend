import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { InventoryLedgerService } from '../../inventory/transactions/inventory-ledger.service';
import { variantInventorySelect } from '../../../common/selects/variant.select';
import { InsufficientStockError } from '../../../common/utils/fefo.util';
import {
    BatchType,
    resolveRequestCompletion,
} from '../../../common/utils/request-completion.util';
import { AlreadyProcessedError } from '../../../common/utils/concurrency.util';

const deliveryDetailSelect = {
    id: true,
    refillRequestId: true,
    deliveredById: true,
    deliveredAt: true,
    type: true,
    receivedById: true,
    confirmedAt: true,
    notes: true,
    items: {
        select: {
            id: true,
            refillItemId: true,
            batchId: true,
            shippedQuantity: true,
            receivedQuantity: true,
            quantityDiscrepancy: true,
            batch: {
                select: {
                    id: true,
                    batchNumber: true,
                    expirationDate: true,
                    variant: { select: variantInventorySelect },
                },
            },
        },
    },
} satisfies Prisma.DepartmentRefillDeliverySelect;

const deliveryListSelect = {
    id: true,
    refillRequestId: true,
    deliveredAt: true,
    type: true,
    confirmedAt: true,
} satisfies Prisma.DepartmentRefillDeliverySelect;

@Injectable()
export class RefillDeliveriesRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly inventoryLedger: InventoryLedgerService,
    ) {}

    async findMany(params: {
        skip: number;
        take: number;
        refillRequestId?: string;
        departmentId?: string;
    }) {
        const where: Prisma.DepartmentRefillDeliveryWhereInput = {
            refillRequestId: params.refillRequestId,
            ...(params.departmentId && {
                refillRequest: { departmentId: params.departmentId },
            }),
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.departmentRefillDelivery.findMany({
                where,
                select: deliveryListSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { deliveredAt: 'desc' },
            }),
            this.prisma.departmentRefillDelivery.count({ where }),
        ]);

        return { items, total };
    }

    async findDepartmentIdForDelivery(id: string): Promise<string | null> {
        const delivery = await this.prisma.departmentRefillDelivery.findUnique({
            where: { id },
            select: { refillRequest: { select: { departmentId: true } } },
        });
        return delivery?.refillRequest.departmentId ?? null;
    }
    findById(id: string) {
        return this.prisma.departmentRefillDelivery.findUnique({
            where: { id },
            select: deliveryDetailSelect,
        });
    }

    findRefillRequestForDelivery(id: string) {
        return this.prisma.departmentRefillRequest.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
                departmentId: true,
                requestedById: true,
                department: {
                    select: { id: true, type: true, tracksInventory: true },
                },
                items: {
                    select: {
                        id: true,
                        variantId: true,
                        approvedQuantity: true,
                        requestedQuantity: true,
                    },
                },
            },
        });
    }

    findBatchStock(batchId: string, departmentId: string) {
        return this.prisma.batchStock.findUnique({
            where: { batchId_departmentId: { batchId, departmentId } },
            include: { batch: { select: { id: true, variantId: true } } },
        });
    }

    createDelivery(params: {
        refillRequestId: string;
        deliveredById: string;
        warehouseDepartmentId: string;
        type: BatchType;
        notes?: string;
        lines: {
            refillItemId: string;
            batchId: string;
            shippedQuantity: number;
        }[];
    }) {
        return this.prisma.$transaction(async (tx) => {
            const delivery = await tx.departmentRefillDelivery.create({
                data: {
                    refillRequestId: params.refillRequestId,
                    deliveredById: params.deliveredById,
                    type: params.type,
                    notes: params.notes,
                },
            });

            const batchIds = [...new Set(params.lines.map((l) => l.batchId))];
            const batches = await tx.batch.findMany({
                where: { id: { in: batchIds } },
                select: { id: true, variantId: true },
            });
            const variantIdByBatch = new Map(
                batches.map((b) => [b.id, b.variantId]),
            );

            for (const line of params.lines) {
                await tx.departmentRefillDeliveryItem.create({
                    data: {
                        deliveryId: delivery.id,
                        refillItemId: line.refillItemId,
                        batchId: line.batchId,
                        shippedQuantity: line.shippedQuantity,
                    },
                });

                const updated = await tx.$queryRaw<{ quantity: number }[]>`
                UPDATE batch_stock
                SET quantity = quantity - ${line.shippedQuantity}
                WHERE batch_id = ${line.batchId}::uuid
                  AND department_id = ${params.warehouseDepartmentId}::uuid
                  AND quantity >= ${line.shippedQuantity}
                RETURNING quantity::float AS "quantity"
            `;
                if (updated.length === 0) {
                    throw new InsufficientStockError(line.shippedQuantity);
                }

                const variantId = variantIdByBatch.get(line.batchId);
                if (!variantId) {
                    throw new Error('Selected batch does not exist.');
                }

                await this.inventoryLedger.record(tx, {
                    transactionType: 'department_transfer_out',
                    variantId,
                    batchId: line.batchId,
                    departmentId: params.warehouseDepartmentId,
                    quantity: -line.shippedQuantity,
                    balanceAfter: updated[0].quantity,
                    referenceType: 'refill_request',
                    referenceId: params.refillRequestId,
                    performedById: params.deliveredById,
                });
            }

            return tx.departmentRefillDelivery.findUniqueOrThrow({
                where: { id: delivery.id },
                select: deliveryDetailSelect,
            });
        });
    }

    findDeliveryItemsForConfirm(deliveryId: string) {
        return this.prisma.departmentRefillDeliveryItem.findMany({
            where: { deliveryId },
            select: {
                id: true,
                refillItemId: true,
                batchId: true,
                shippedQuantity: true,
                receivedQuantity: true,
            },
        });
    }

    confirmDelivery(params: {
        deliveryId: string;
        refillRequestId: string;
        departmentId: string;
        confirmedById: string;
        notes?: string;
        batchType: BatchType;
        confirmations: {
            deliveryItemId: string;
            refillItemId: string;
            batchId: string;
            shipped: number;
            received: number;
        }[];
    }) {
        return this.prisma.$transaction(async (tx) => {
            const claimed = await tx.departmentRefillDelivery.updateMany({
                where: { id: params.deliveryId, confirmedAt: null },
                data: {
                    receivedById: params.confirmedById,
                    confirmedAt: new Date(),
                    notes: params.notes,
                },
            });
            if (claimed.count === 0) {
                throw new AlreadyProcessedError(
                    'This delivery has already been confirmed.',
                );
            }

            for (const c of params.confirmations) {
                await tx.departmentRefillDeliveryItem.update({
                    where: { id: c.deliveryItemId },
                    data: {
                        receivedQuantity: c.received,
                        quantityDiscrepancy: c.shipped - c.received,
                    },
                });

                const updatedStock = await tx.batchStock.upsert({
                    where: {
                        batchId_departmentId: {
                            batchId: c.batchId,
                            departmentId: params.departmentId,
                        },
                    },
                    update: { quantity: { increment: c.received } },
                    create: {
                        batchId: c.batchId,
                        departmentId: params.departmentId,
                        quantity: c.received,
                    },
                });

                const batch = await tx.batch.findUniqueOrThrow({
                    where: { id: c.batchId },
                    select: { variantId: true },
                });

                await this.inventoryLedger.record(tx, {
                    transactionType: 'department_transfer_in',
                    variantId: batch.variantId,
                    batchId: c.batchId,
                    departmentId: params.departmentId,
                    quantity: c.received,
                    balanceAfter: Number(updatedStock.quantity),
                    referenceType: 'department_refill_delivery_item',
                    referenceId: c.deliveryItemId,
                    performedById: params.confirmedById,
                });
            }

            const affectedItemIds = [
                ...new Set(params.confirmations.map((c) => c.refillItemId)),
            ];
            for (const refillItemId of affectedItemIds) {
                const totals = await tx.departmentRefillDeliveryItem.aggregate({
                    where: {
                        refillItemId,
                        delivery: { confirmedAt: { not: null } },
                    },
                    _sum: { receivedQuantity: true },
                });
                const cumulative = Number(totals._sum.receivedQuantity ?? 0);

                const item = await tx.departmentRefillItem.findUniqueOrThrow({
                    where: { id: refillItemId },
                });

                await tx.departmentRefillItem.update({
                    where: { id: refillItemId },
                    data: {
                        deliveredQuantity: cumulative,
                        quantityDiscrepancy:
                            Number(item.approvedQuantity ?? 0) - cumulative,
                    },
                });
            }

            const allItems = await tx.departmentRefillItem.findMany({
                where: { refillRequestId: params.refillRequestId },
            });

            const outcome = resolveRequestCompletion(
                allItems.map((i) => ({
                    approvedQuantity:
                        i.approvedQuantity !== null
                            ? Number(i.approvedQuantity)
                            : null,
                    cumulativeConfirmed: Number(i.deliveredQuantity ?? 0),
                })),
                params.batchType,
            );

            await tx.departmentRefillRequest.update({
                where: { id: params.refillRequestId },
                data: { status: outcome },
            });

            return tx.departmentRefillDelivery.findUniqueOrThrow({
                where: { id: params.deliveryId },
                select: deliveryDetailSelect,
            });
        });
    }
    countUnconfirmedForRequest(refillRequestId: string) {
        return this.prisma.departmentRefillDelivery.count({
            where: { refillRequestId, confirmedAt: null },
        });
    }
    async cancelUnconfirmedDeliveriesForRequest(params: {
        refillRequestId: string;
        warehouseDepartmentId: string;
        cancelledById: string;
    }): Promise<number> {
        return this.prisma.$transaction(async (tx) => {
            const deliveries = await tx.departmentRefillDelivery.findMany({
                where: {
                    refillRequestId: params.refillRequestId,
                    confirmedAt: null,
                },
                select: {
                    id: true,
                    items: {
                        select: {
                            id: true,
                            batchId: true,
                            shippedQuantity: true,
                        },
                    },
                },
            });

            for (const delivery of deliveries) {
                for (const item of delivery.items) {
                    const updatedStock = await tx.batchStock.upsert({
                        where: {
                            batchId_departmentId: {
                                batchId: item.batchId,
                                departmentId: params.warehouseDepartmentId,
                            },
                        },
                        update: {
                            quantity: { increment: item.shippedQuantity },
                        },
                        create: {
                            batchId: item.batchId,
                            departmentId: params.warehouseDepartmentId,
                            quantity: item.shippedQuantity,
                        },
                    });

                    const batch = await tx.batch.findUniqueOrThrow({
                        where: { id: item.batchId },
                        select: { variantId: true },
                    });

                    await this.inventoryLedger.record(tx, {
                        transactionType: 'department_transfer_in',
                        variantId: batch.variantId,
                        batchId: item.batchId,
                        departmentId: params.warehouseDepartmentId,
                        quantity: Number(item.shippedQuantity),
                        balanceAfter: Number(updatedStock.quantity),
                        referenceType: 'refill_request',
                        referenceId: params.refillRequestId,
                        performedById: params.cancelledById,
                    });
                }

                await tx.departmentRefillDeliveryItem.deleteMany({
                    where: { deliveryId: delivery.id },
                });
                await tx.departmentRefillDelivery.delete({
                    where: { id: delivery.id },
                });
            }

            return deliveries.length;
        });
    }
}
