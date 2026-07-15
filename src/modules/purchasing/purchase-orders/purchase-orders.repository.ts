import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';

const purchaseOrderDetailSelect = {
  id: true,
  orderNumber: true,
  purchaseRequestId: true,
  supplierId: true,
  status: true,
  orderedAt: true,
  expectedDeliveryDate: true,
  notes: true,
  createdAt: true,
  supplier: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      purchaseRequestItemId: true,
      variantId: true,
      orderedQuantity: true,
      unitPrice: true,
      receivedQuantity: true,
      variant: { select: { id: true, variantName: true, sku: true } },
    },
  },
} satisfies Prisma.PurchaseOrderSelect;

const purchaseOrderListSelect = {
  id: true,
  orderNumber: true,
  purchaseRequestId: true,
  status: true,
  supplier: { select: { id: true, name: true } },
  createdAt: true,
} satisfies Prisma.PurchaseOrderSelect;

@Injectable()
export class PurchaseOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    skip: number;
    take: number;
    purchaseRequestId?: string;
    status?: PurchaseOrderStatus;
  }) {
    const where: Prisma.PurchaseOrderWhereInput = {
      purchaseRequestId: params.purchaseRequestId,
      status: params.status,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        select: purchaseOrderListSelect,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { items, total };
  }

  findById(id: string) {
    return this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: purchaseOrderDetailSelect,
    });
  }

  findPurchaseRequestForOrder(purchaseRequestId: string) {
    return this.prisma.purchaseRequest.findUnique({
      where: { id: purchaseRequestId },
      select: {
        id: true,
        status: true,
        items: {
          select: {
            id: true,
            variantId: true,
            committeeApprovedQuantity: true,
            receivedQuantity: true,
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

  sumOrderedQuantityForRequestItem(purchaseRequestItemId: string) {
    return this.prisma.purchaseOrderItem.aggregate({
      where: { purchaseRequestItemId },
      _sum: { orderedQuantity: true },
    });
  }

  create(data: {
    orderNumber: string;
    purchaseRequestId: string;
    supplierId: string;
    createdById: string;
    expectedDeliveryDate?: Date;
    items: {
      purchaseRequestItemId: string;
      variantId: string;
      orderedQuantity: number;
      unitPrice?: number;
    }[];
  }) {
    return this.prisma.purchaseOrder.create({
      data: {
        orderNumber: data.orderNumber,
        purchaseRequestId: data.purchaseRequestId,
        supplierId: data.supplierId,
        createdById: data.createdById,
        expectedDeliveryDate: data.expectedDeliveryDate,
        items: { create: data.items },
      },
      select: purchaseOrderDetailSelect,
    });
  }

  send(id: string) {
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'sent', orderedAt: new Date() },
      select: purchaseOrderDetailSelect,
    });
  }

  cancel(id: string) {
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'cancelled' },
      select: purchaseOrderDetailSelect,
    });
  }
}
