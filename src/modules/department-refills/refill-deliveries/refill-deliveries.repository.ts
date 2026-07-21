import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { InventoryLedgerService } from '../../inventory/transactions/inventory-ledger.service';
import { Prisma } from '@prisma/client';
import { variantInventorySelect } from '../../../common/selects/variant.select';
import { InsufficientStockError } from '../../../common/utils/fefo.util';
const deliveryDetailSelect = {
    id: true,
    refillRequestId: true,
    deliveredById: true,
    deliveredAt: true,
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
    }) {
        const where: Prisma.DepartmentRefillDeliveryWhereInput = {
            refillRequestId: params.refillRequestId,
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
                department: {
                    select: { id: true, type: true, tracksInventory: true },
                },
                items: {
                    select: {
                        id: true,
                        variantId: true,
                        preparedQuantity: true,
                        requestedQuantity: true,
                    },
                },
            },
        });
    }

    findWarehouseDepartment() {
        return this.prisma.department.findFirst({
            where: { type: 'central_warehouse' },
            select: { id: true },
        });
    }

    sumShippedForRefillItem(refillItemId: string) {
        return this.prisma.departmentRefillDeliveryItem.aggregate({
            where: { refillItemId },
            _sum: { shippedQuantity: true },
        });
    }

    sumReceivedForRefillItem(refillItemId: string) {
        return this.prisma.departmentRefillDeliveryItem.aggregate({
            where: { refillItemId, receivedQuantity: { not: null } },
            _sum: { receivedQuantity: true },
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
                    throw new BadRequestException(
                        'Selected batch does not exist.',
                    );
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
        confirmations: {
            deliveryItemId: string;
            refillItemId: string;
            batchId: string;
            shipped: number;
            received: number;
        }[];
    }) {
        return this.prisma.$transaction(async (tx) => {
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

            await tx.departmentRefillDelivery.update({
                where: { id: params.deliveryId },
                data: {
                    receivedById: params.confirmedById,
                    confirmedAt: new Date(),
                    notes: params.notes,
                },
            });

            const affectedItemIds = [
                ...new Set(params.confirmations.map((c) => c.refillItemId)),
            ];
            for (const refillItemId of affectedItemIds) {
                const item = await tx.departmentRefillItem.findUniqueOrThrow({
                    where: { id: refillItemId },
                });
                const totalReceived =
                    await tx.departmentRefillDeliveryItem.aggregate({
                        where: {
                            refillItemId,
                            receivedQuantity: { not: null },
                        },
                        _sum: { receivedQuantity: true },
                    });
                const deliveredQuantity = Number(
                    totalReceived._sum.receivedQuantity ?? 0,
                );

                await tx.departmentRefillItem.update({
                    where: { id: refillItemId },
                    data: {
                        deliveredQuantity,
                        quantityDiscrepancy:
                            Number(item.preparedQuantity ?? 0) -
                            deliveredQuantity,
                    },
                });
            }

            const allItems = await tx.departmentRefillItem.findMany({
                where: { refillRequestId: params.refillRequestId },
            });
            const fullyDelivered = allItems.every(
                (i) =>
                    i.preparedQuantity !== null &&
                    Number(i.deliveredQuantity ?? 0) >=
                        Number(i.preparedQuantity),
            );
            const partiallyDelivered = allItems.some(
                (i) => Number(i.deliveredQuantity ?? 0) > 0,
            );

            await tx.departmentRefillRequest.update({
                where: { id: params.refillRequestId },
                data: {
                    status: fullyDelivered
                        ? 'delivered'
                        : partiallyDelivered
                          ? 'partially_delivered'
                          : undefined,
                },
            });

            return tx.departmentRefillDelivery.findUniqueOrThrow({
                where: { id: params.deliveryId },
                select: deliveryDetailSelect,
            });
        });
    }
}
