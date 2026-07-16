import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { Prisma, RefillRequestStatus } from '@prisma/client';

const refillRequestDetailSelect = {
  id: true,
  requestNumber: true,
  departmentId: true,
  department: { select: { id: true, name: true, type: true } },
  requestedById: true,
  requestedBy: { select: { id: true, fullName: true } },
  status: true,
  hospitalApprovedById: true,
  hospitalApprovedAt: true,
  hospitalRejectionReason: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      variantId: true,
      requestedQuantity: true,
      preparedQuantity: true,
      deliveredQuantity: true,
      quantityDiscrepancy: true,
      variant: { select: { id: true, variantName: true, sku: true } },
    },
  },
} satisfies Prisma.DepartmentRefillRequestSelect;
const refillRequestListSelect = {
  id: true,
  requestNumber: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  status: true,
  createdAt: true,
} satisfies Prisma.DepartmentRefillRequestSelect;

@Injectable()
export class RefillRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    skip: number;
    take: number;
    status?: RefillRequestStatus;
    departmentId?: string;
  }) {
    const where: Prisma.DepartmentRefillRequestWhereInput = {
      status: params.status,
      departmentId: params.departmentId,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.departmentRefillRequest.findMany({
        where,
        select: refillRequestListSelect,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.departmentRefillRequest.count({ where }),
    ]);

    return { items, total };
  }

  findById(id: string) {
    return this.prisma.departmentRefillRequest.findUnique({
      where: { id },
      select: refillRequestDetailSelect,
    });
  }

  findVariantsWithActivation(ids: string[]) {
    return this.prisma.productVariant.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        isActive: true,
        product: { select: { isActive: true } },
      },
    });
  }

  variantsExist(ids: string[]) {
    return this.prisma.productVariant.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
  }

  findRequestingUserContext(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        departmentId: true,
        department: { select: { id: true, type: true, isActive: true } },
        role: { select: { name: true } },
      },
    });
  }

  create(data: {
    requestNumber: string;
    departmentId: string;
    requestedById: string;
    notes?: string;
    items: { variantId: string; requestedQuantity: number }[];
  }) {
    return this.prisma.departmentRefillRequest.create({
      data: {
        requestNumber: data.requestNumber,
        departmentId: data.departmentId,
        requestedById: data.requestedById,
        notes: data.notes,
        items: { create: data.items },
      },
      select: refillRequestDetailSelect,
    });
  }

  async replaceItems(
    id: string,
    notes: string | undefined,
    items?: { variantId: string; requestedQuantity: number }[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (items) {
        await tx.departmentRefillItem.deleteMany({
          where: { refillRequestId: id },
        });
        await tx.departmentRefillItem.createMany({
          data: items.map((item) => ({ ...item, refillRequestId: id })),
        });
      }
      return tx.departmentRefillRequest.update({
        where: { id },
        data: { notes },
        select: refillRequestDetailSelect,
      });
    });
  }

  updateStatus(
    id: string,
    data: Prisma.DepartmentRefillRequestUncheckedUpdateInput,
  ) {
    return this.prisma.departmentRefillRequest.update({
      where: { id },
      data,
      select: refillRequestDetailSelect,
    });
  }

  setPreparedQuantities(
    id: string,
    items: { refillItemId: string; preparedQuantity: number }[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.departmentRefillItem.update({
          where: { id: item.refillItemId },
          data: { preparedQuantity: item.preparedQuantity },
        });
      }
      return tx.departmentRefillRequest.update({
        where: { id },
        data: { status: 'ready_for_delivery' },
        select: refillRequestDetailSelect,
      });
    });
  }

  async zeroDepartmentInventoryOnSubmit(
    departmentId: string,
    variantIds: string[],
  ) {
    for (const variantId of variantIds) {
      await this.prisma.departmentInventory.upsert({
        where: { departmentId_variantId: { departmentId, variantId } },
        update: { currentQuantity: 0 },
        create: { departmentId, variantId, currentQuantity: 0 },
      });
    }
  }
}
