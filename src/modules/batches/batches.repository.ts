import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const batchSelect = {
  id: true,
  variantId: true,
  supplierId: true,
  batchNumber: true,
  quantityReceived: true,
  purchasePrice: true,
  manufacturingDate: true,
  expirationDate: true,
  receivingDate: true,
  variant: { select: { id: true, variantName: true, sku: true } },
  supplier: { select: { id: true, name: true } },
  batchStocks: {
    select: {
      id: true,
      departmentId: true,
      quantity: true,
      department: { select: { id: true, name: true } },
    },
  },
  createdAt: true,
} satisfies Prisma.BatchSelect;

@Injectable()
export class BatchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    skip: number;
    take: number;
    variantId?: string;
    departmentId?: string;
  }) {
    const where: Prisma.BatchWhereInput = {
      variantId: params.variantId,
      ...(params.departmentId && {
        batchStocks: { some: { departmentId: params.departmentId } },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.batch.findMany({
        where,
        select: batchSelect,
        skip: params.skip,
        take: params.take,
        orderBy: { expirationDate: 'asc' },
      }),
      this.prisma.batch.count({ where }),
    ]);

    return { items, total };
  }

  findById(id: string) {
    return this.prisma.batch.findUnique({ where: { id }, select: batchSelect });
  }
}
