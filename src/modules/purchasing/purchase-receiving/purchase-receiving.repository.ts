import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { InventoryLedgerService } from '../../inventory/transactions/inventory-ledger.service';
import { Prisma } from '@prisma/client';
import { variantInventorySelect } from '../../../common/selects/variant.select';
const purchaseReceiptDetailSelect = {
    id: true,
    purchaseOrderId: true,
    purchaseRequestId: true,
    receivingDate: true,
    status: true,
    confirmedById: true,
    confirmedAt: true,
    notes: true,
    createdAt: true,
    receivedBy: { select: { id: true, fullName: true } },
    confirmedBy: { select: { id: true, fullName: true } },
    items: {
        select: {
            id: true,
            purchaseOrderItemId: true,
            variantId: true,
            supplierId: true,
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
            purchaseOrderItem: { select: { purchaseRequestItemId: true } },
        },
    },
} satisfies Prisma.PurchaseReceiptSelect;

const purchaseReceiptListSelect = {
    id: true,
    purchaseOrderId: true,
    purchaseRequestId: true,
    receivingDate: true,
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
        purchaseOrderId?: string;
        purchaseRequestId?: string;
    }) {
        const where: Prisma.PurchaseReceiptWhereInput = {
            purchaseOrderId: params.purchaseOrderId,
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

    findOrderForReceiving(purchaseOrderId: string) {
        return this.prisma.purchaseOrder.findUnique({
            where: { id: purchaseOrderId },
            select: {
                id: true,
                status: true,
                purchaseRequestId: true,
                supplierId: true,
                items: {
                    select: {
                        id: true,
                        purchaseRequestItemId: true,
                        variantId: true,
                        orderedQuantity: true,
                        receivedQuantity: true,
                    },
                },
            },
        });
    }

    findOrderDestination(purchaseOrderId: string) {
        return this.prisma.purchaseOrder.findUnique({
            where: { id: purchaseOrderId },
            select: { id: true, destinationDepartmentId: true },
        });
    }

    recordReceipt(params: {
        purchaseOrderId: string;
        purchaseRequestId: string;
        supplierId: string;
        receivedById: string;
        receivingDate: Date;
        notes?: string;
        lines: {
            purchaseOrderItemId: string;
            variantId: string;
            expectedQuantity: number;
            quantity: number;
            batchNumber: string;
            manufacturingDate?: Date;
            expirationDate?: Date;
            purchasePrice?: number;
        }[];
    }) {
        return this.prisma.purchaseReceipt.create({
            data: {
                purchaseOrderId: params.purchaseOrderId,
                purchaseRequestId: params.purchaseRequestId,
                receivedById: params.receivedById,
                receivingDate: params.receivingDate,
                notes: params.notes,
                status: 'pending_confirmation',
                items: {
                    create: params.lines.map((line) => ({
                        purchaseOrderItemId: line.purchaseOrderItemId,
                        variantId: line.variantId,
                        supplierId: params.supplierId,
                        expectedQuantity: line.expectedQuantity,
                        quantity: line.quantity,
                        quantityDiscrepancy:
                            line.expectedQuantity - line.quantity,
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
        purchaseOrderId: string;
        purchaseRequestId: string;
        warehouseDepartmentId: string;
        receivingDate: Date;
        confirmedById: string;
        notes?: string;
        confirmations: {
            receiptItemId: string;
            purchaseOrderItemId: string;
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

                await tx.purchaseOrderItem.update({
                    where: { id: c.purchaseOrderItemId },
                    data: {
                        receivedQuantity: { increment: c.confirmedQuantity },
                    },
                });

                await tx.purchaseRequestItem.update({
                    where: { id: c.purchaseRequestItemId },
                    data: {
                        receivedQuantity: { increment: c.confirmedQuantity },
                    },
                });
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

            const updatedOrderItems = await tx.purchaseOrderItem.findMany({
                where: { purchaseOrderId: params.purchaseOrderId },
                select: { orderedQuantity: true, receivedQuantity: true },
            });
            const orderFullyReceived = updatedOrderItems.every(
                (i) => Number(i.receivedQuantity) >= Number(i.orderedQuantity),
            );
            const orderPartiallyReceived = updatedOrderItems.some(
                (i) => Number(i.receivedQuantity) > 0,
            );

            await tx.purchaseOrder.update({
                where: { id: params.purchaseOrderId },
                data: {
                    status: orderFullyReceived
                        ? 'received'
                        : orderPartiallyReceived
                          ? 'partially_received'
                          : 'sent',
                },
            });

            const requestItems = await tx.purchaseRequestItem.findMany({
                where: { purchaseRequestId: params.purchaseRequestId },
                select: {
                    committeeApprovedQuantity: true,
                    receivedQuantity: true,
                },
            });
            const requestFullyReceived = requestItems.every(
                (i) =>
                    i.committeeApprovedQuantity !== null &&
                    Number(i.receivedQuantity) >=
                        Number(i.committeeApprovedQuantity),
            );
            const requestPartiallyReceived = requestItems.some(
                (i) => Number(i.receivedQuantity) > 0,
            );

            await tx.purchaseRequest.update({
                where: { id: params.purchaseRequestId },
                data: {
                    status: requestFullyReceived
                        ? 'received'
                        : requestPartiallyReceived
                          ? 'partially_received'
                          : undefined,
                },
            });

            return tx.purchaseReceipt.findUniqueOrThrow({
                where: { id: params.receiptId },
                select: purchaseReceiptDetailSelect,
            });
        });
    }
}
