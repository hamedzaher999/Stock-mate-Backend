import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const purchaseReceiptDetailSelect = {
  id: true,
  purchaseOrderId: true,
  purchaseRequestId: true,
  receivingDate: true,
  notes: true,
  createdAt: true,
  receivedBy: { select: { id: true, fullName: true } },
  items: {
    select: {
      id: true,
      purchaseOrderItemId: true,
      variantId: true,
      supplierId: true,
      expectedQuantity: true,
      quantity: true,
      quantityDiscrepancy: true,
      purchasePrice: true,
      batchNumber: true,
      manufacturingDate: true,
      expirationDate: true,
      variant: { select: { id: true, variantName: true, sku: true } },
      batch: { select: { id: true } },
    },
  },
} satisfies Prisma.PurchaseReceiptSelect;

const purchaseReceiptListSelect = {
  id: true,
  purchaseOrderId: true,
  purchaseRequestId: true,
  receivingDate: true,
  receivedBy: { select: { id: true, fullName: true } },
  createdAt: true,
} satisfies Prisma.PurchaseReceiptSelect;

@Injectable()
export class PurchaseReceivingRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  findWarehouseDepartment() {
    return this.prisma.department.findFirst({
      where: { type: 'central_warehouse' },
      select: { id: true },
    });
  }

  receive(params: {
    purchaseOrderId: string;
    purchaseRequestId: string;
    supplierId: string;
    warehouseDepartmentId: string;
    receivedById: string;
    receivingDate: Date;
    notes?: string;
    lines: {
      purchaseOrderItemId: string;
      purchaseRequestItemId: string;
      variantId: string;
      expectedQuantity: number;
      quantity: number;
      batchNumber: string;
      manufacturingDate?: Date;
      expirationDate?: Date;
      purchasePrice?: number;
    }[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseReceipt.create({
        data: {
          purchaseOrderId: params.purchaseOrderId,
          purchaseRequestId: params.purchaseRequestId,
          receivedById: params.receivedById,
          receivingDate: params.receivingDate,
          notes: params.notes,
        },
      });

      for (const line of params.lines) {
        const receiptItem = await tx.purchaseReceiptItem.create({
          data: {
            purchaseReceiptId: receipt.id,
            purchaseOrderItemId: line.purchaseOrderItemId,
            variantId: line.variantId,
            supplierId: params.supplierId,
            expectedQuantity: line.expectedQuantity,
            quantity: line.quantity,
            quantityDiscrepancy: line.expectedQuantity - line.quantity,
            purchasePrice: line.purchasePrice,
            batchNumber: line.batchNumber,
            manufacturingDate: line.manufacturingDate,
            expirationDate: line.expirationDate,
          },
        });

        const batch = await tx.batch.create({
          data: {
            purchaseReceiptItemId: receiptItem.id,
            variantId: line.variantId,
            supplierId: params.supplierId,
            batchNumber: line.batchNumber,
            quantityReceived: line.quantity,
            purchasePrice: line.purchasePrice,
            manufacturingDate: line.manufacturingDate,
            expirationDate: line.expirationDate,
            receivingDate: params.receivingDate,
            createdById: params.receivedById,
          },
        });

        await tx.batchStock.create({
          data: {
            batchId: batch.id,
            departmentId: params.warehouseDepartmentId,
            quantity: line.quantity,
          },
        });

        await tx.purchaseOrderItem.update({
          where: { id: line.purchaseOrderItemId },
          data: { receivedQuantity: { increment: line.quantity } },
        });

        await tx.purchaseRequestItem.update({
          where: { id: line.purchaseRequestItemId },
          data: { receivedQuantity: { increment: line.quantity } },
        });
      }

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
        select: { committeeApprovedQuantity: true, receivedQuantity: true },
      });
      const requestFullyReceived = requestItems.every(
        (i) =>
          i.committeeApprovedQuantity !== null &&
          Number(i.receivedQuantity) >= Number(i.committeeApprovedQuantity),
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
        where: { id: receipt.id },
        select: purchaseReceiptDetailSelect,
      });
    });
  }
}
