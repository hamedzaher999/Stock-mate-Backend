import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { InventoryLedgerService } from '../../inventory/transactions/inventory-ledger.service';
import { variantInventorySelect } from '../../../common/selects/variant.select';
import {
    BatchType,
    resolveRequestCompletion,
} from '../../../common/utils/request-completion.util';

const purchaseReceiptDetailSelect = {
    id: true,
    purchaseRequestId: true,
    supplierId: true,
    receivingDate: true,
    type: true,
    status: true,
    confirmedById: true,
    confirmedAt: true,
    notes: true,
    createdAt: true,
    receivedBy: { select: { id: true, fullName: true } },
    confirmedBy: { select: { id: true, fullName: true } },
    supplier: { select: { id: true, name: true } },
    items: {
        select: {
            id: true,
            purchaseRequestItemId: true,
            variantId: true,
            expectedQuantity: true,
            quantity: true,
            quantityDiscrepancy: true,
            confirmedQuantity: true,
            confirmedQuantityDiscrepancy: true,
            purchasePrice: true,
            batchNumber: true,
            manufacturingDate: true,
            expirationDate: true,
            variant: { select: variantInventorySelect },
            batch: { select: { id: true } },
        },
    },
} satisfies Prisma.PurchaseReceiptSelect;

const purchaseReceiptListSelect = {
    id: true,
    purchaseRequestId: true,
    supplierId: true,
    receivingDate: true,
    type: true,
    status: true,
    receivedBy: { select: { id: true, fullName: true } },
    createdAt: true,
} satisfies Prisma.PurchaseReceiptSelect;

@Injectable()
export class PurchaseReceivingRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly inventoryLedger: InventoryLedgerService,
    ) {}

    async findMany(params: {
        skip: number;
        take: number;
        purchaseRequestId?: string;
    }) {
        const where: Prisma.PurchaseReceiptWhereInput = {
            purchaseRequestId: params.purchaseRequestId,
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.purchaseReceipt.findMany({
                where,
                select: purchaseReceiptListSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.purchaseReceipt.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.purchaseReceipt.findUnique({
            where: { id },
            select: purchaseReceiptDetailSelect,
        });
    }

    findImageKey(id: string) {
        return this.prisma.purchaseReceipt.findUnique({
            where: { id },
            select: { id: true, receiptImageKey: true },
        });
    }

    findRequestForReceiving(purchaseRequestId: string) {
        return this.prisma.purchaseRequest.findUnique({
            where: { id: purchaseRequestId },
            select: {
                id: true,
                status: true,
                requestedById: true,
                items: {
                    select: {
                        id: true,
                        variantId: true,
                        approvedQuantity: true,
                        receivedQuantity: true,
                        variant: {
                            select: {
                                isActive: true,
                                product: { select: { isActive: true } },
                            },
                        },
                    },
                },
            },
        });
    }

    supplierExists(id: string) {
        return this.prisma.supplier.findUnique({
            where: { id },
            select: { id: true, isActive: true },
        });
    }

    recordReceipt(params: {
        purchaseRequestId: string;
        supplierId: string;
        receivedById: string;
        receivingDate: Date;
        type: BatchType;
        notes?: string;
        receiptImageKey: string;
        lines: {
            purchaseRequestItemId: string;
            variantId: string;
            expectedQuantity: number | null;
            quantity: number;
            batchNumber: string;
            manufacturingDate?: Date;
            expirationDate?: Date;
            purchasePrice?: number;
        }[];
    }) {
        return this.prisma.purchaseReceipt.create({
            data: {
                purchaseRequestId: params.purchaseRequestId,
                supplierId: params.supplierId,
                receivedById: params.receivedById,
                receivingDate: params.receivingDate,
                type: params.type,
                notes: params.notes,
                status: 'pending_confirmation',
                receiptImageKey: params.receiptImageKey,
                items: {
                    create: params.lines.map((line) => ({
                        purchaseRequestItemId: line.purchaseRequestItemId,
                        variantId: line.variantId,
                        expectedQuantity: line.expectedQuantity,
                        quantity: line.quantity,
                        quantityDiscrepancy:
                            line.expectedQuantity !== null
                                ? line.expectedQuantity - line.quantity
                                : 0,
                        batchNumber: line.batchNumber,
                        manufacturingDate: line.manufacturingDate,
                        expirationDate: line.expirationDate,
                        purchasePrice: line.purchasePrice,
                    })),
                },
            },
            select: purchaseReceiptDetailSelect,
        });
    }

    confirmReceipt(params: {
        receiptId: string;
        purchaseRequestId: string;
        warehouseDepartmentId: string;
        receivingDate: Date;
        confirmedById: string;
        notes?: string;
        batchType: BatchType;
        confirmations: {
            receiptItemId: string;
            purchaseRequestItemId: string;
            variantId: string;
            supplierId: string;
            declaredQuantity: number;
            confirmedQuantity: number;
            batchNumber: string;
            manufacturingDate: Date | null;
            expirationDate: Date | null;
            purchasePrice: number | null;
        }[];
    }) {
        return this.prisma.$transaction(async (tx) => {
            for (const c of params.confirmations) {
                await tx.purchaseReceiptItem.update({
                    where: { id: c.receiptItemId },
                    data: {
                        confirmedQuantity: c.confirmedQuantity,
                        confirmedQuantityDiscrepancy:
                            c.declaredQuantity - c.confirmedQuantity,
                    },
                });

                if (c.confirmedQuantity > 0) {
                    const batch = await tx.batch.create({
                        data: {
                            purchaseReceiptItemId: c.receiptItemId,
                            variantId: c.variantId,
                            supplierId: c.supplierId,
                            batchNumber: c.batchNumber,
                            quantityReceived: c.confirmedQuantity,
                            purchasePrice: c.purchasePrice,
                            manufacturingDate: c.manufacturingDate,
                            expirationDate: c.expirationDate,
                            receivingDate: params.receivingDate,
                            createdById: params.confirmedById,
                        },
                    });

                    await tx.batchStock.create({
                        data: {
                            batchId: batch.id,
                            departmentId: params.warehouseDepartmentId,
                            quantity: c.confirmedQuantity,
                        },
                    });

                    await this.inventoryLedger.record(tx, {
                        transactionType: 'purchase_receipt',
                        variantId: c.variantId,
                        batchId: batch.id,
                        departmentId: params.warehouseDepartmentId,
                        quantity: c.confirmedQuantity,
                        balanceAfter: c.confirmedQuantity,
                        referenceType: 'purchase_receipt',
                        referenceId: params.receiptId,
                        performedById: params.confirmedById,
                    });
                }
            }

            await tx.purchaseReceipt.update({
                where: { id: params.receiptId },
                data: {
                    status: 'confirmed',
                    confirmedById: params.confirmedById,
                    confirmedAt: new Date(),
                    notes: params.notes,
                },
            });

            const affectedItemIds = [
                ...new Set(
                    params.confirmations.map((c) => c.purchaseRequestItemId),
                ),
            ];

            for (const itemId of affectedItemIds) {
                const totals = await tx.purchaseReceiptItem.aggregate({
                    where: {
                        purchaseRequestItemId: itemId,
                        purchaseReceipt: { status: 'confirmed' },
                    },
                    _sum: { confirmedQuantity: true },
                });
                const cumulative = Number(totals._sum.confirmedQuantity ?? 0);

                const item = await tx.purchaseRequestItem.findUniqueOrThrow({
                    where: { id: itemId },
                });

                await tx.purchaseRequestItem.update({
                    where: { id: itemId },
                    data: {
                        receivedQuantity: cumulative,
                        quantityDiscrepancy:
                            Number(item.approvedQuantity ?? 0) - cumulative,
                    },
                });
            }

            const allItems = await tx.purchaseRequestItem.findMany({
                where: { purchaseRequestId: params.purchaseRequestId },
            });

            const outcome = resolveRequestCompletion(
                allItems.map((i) => ({
                    approvedQuantity:
                        i.approvedQuantity !== null
                            ? Number(i.approvedQuantity)
                            : null,
                    cumulativeConfirmed: Number(i.receivedQuantity),
                })),
                params.batchType,
            );

            await tx.purchaseRequest.update({
                where: { id: params.purchaseRequestId },
                data: { status: outcome },
            });

            return tx.purchaseReceipt.findUniqueOrThrow({
                where: { id: params.receiptId },
                select: purchaseReceiptDetailSelect,
            });
        });
    }

    async replaceItems(
        id: string,
        data: {
            receivingDate?: Date;
            notes?: string;
            items?: {
                purchaseRequestItemId: string;
                variantId: string;
                expectedQuantity: number | null;
                quantity: number;
                batchNumber: string;
                manufacturingDate?: Date;
                expirationDate?: Date;
                purchasePrice?: number;
            }[];
        },
    ) {
        return this.prisma.$transaction(async (tx) => {
            if (data.items) {
                await tx.purchaseReceiptItem.deleteMany({
                    where: { purchaseReceiptId: id },
                });
                await tx.purchaseReceiptItem.createMany({
                    data: data.items.map((item) => ({
                        purchaseReceiptId: id,
                        purchaseRequestItemId: item.purchaseRequestItemId,
                        variantId: item.variantId,
                        expectedQuantity: item.expectedQuantity,
                        quantity: item.quantity,
                        quantityDiscrepancy:
                            item.expectedQuantity !== null
                                ? item.expectedQuantity - item.quantity
                                : 0,
                        batchNumber: item.batchNumber,
                        manufacturingDate: item.manufacturingDate,
                        expirationDate: item.expirationDate,
                        purchasePrice: item.purchasePrice,
                    })),
                });
            }

            return tx.purchaseReceipt.update({
                where: { id },
                data: {
                    receivingDate: data.receivingDate,
                    notes: data.notes,
                },
                select: purchaseReceiptDetailSelect,
            });
        });
    }

    cancel(id: string) {
        return this.prisma.purchaseReceipt.update({
            where: { id },
            data: { status: 'cancelled' },
            select: purchaseReceiptDetailSelect,
        });
    }
}
