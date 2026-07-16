import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const variantDetailSelect = {
  id: true,
  productId: true,
  variantName: true,
  sku: true,
  unitId: true,
  isActive: true,
  product: {
    select: { id: true, name: true, materialType: true, categoryId: true },
  },
  unit: { select: { id: true, name: true, abbreviation: true } },
  variantSuppliers: {
    select: {
      id: true,
      supplierId: true,
      expectedPurchasePrice: true,
      supplierProductCode: true,
      isPreferred: true,
      supplier: { select: { id: true, name: true, isActive: true } },
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductVariantSelect;

const variantListSelect = {
  id: true,
  productId: true,
  variantName: true,
  sku: true,
  unitId: true,
  isActive: true,
  product: { select: { id: true, name: true, materialType: true } },
  unit: { select: { id: true, name: true, abbreviation: true } },
} satisfies Prisma.ProductVariantSelect;

@Injectable()
export class VariantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    skip: number;
    take: number;
    productId?: string;
    isActive?: boolean;
    search?: string;
  }) {
    const where: Prisma.ProductVariantWhereInput = {
      productId: params.productId,
      isActive: params.isActive,
      ...(params.search && {
        OR: [
          { variantName: { contains: params.search, mode: 'insensitive' } },
          { sku: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.productVariant.findMany({
        where,
        select: variantListSelect,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.productVariant.count({ where }),
    ]);

    return { items, total };
  }

  findById(id: string) {
    return this.prisma.productVariant.findUnique({
      where: { id },
      select: variantDetailSelect,
    });
  }

  findBySku(sku: string) {
    return this.prisma.productVariant.findUnique({ where: { sku } });
  }

  productExists(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
  }

  unitExists(id: string) {
    return this.prisma.unit.findUnique({ where: { id }, select: { id: true } });
  }

  suppliersExist(ids: string[]) {
    return this.prisma.supplier.findMany({
      where: { id: { in: ids } },
      select: { id: true, isActive: true },
    });
  }

  create(data: {
    productId: string;
    variantName: string;
    sku: string;
    unitId: string;
    createdById: string;
  }) {
    return this.prisma.productVariant.create({
      data,
      select: variantDetailSelect,
    });
  }

  update(id: string, data: { variantName?: string; unitId?: string }) {
    return this.prisma.productVariant.update({
      where: { id },
      data,
      select: variantDetailSelect,
    });
  }

  updateStatus(id: string, isActive: boolean) {
    return this.prisma.productVariant.update({
      where: { id },
      data: { isActive },
      select: variantDetailSelect,
    });
  }

  setSuppliers(
    variantId: string,
    suppliers: {
      supplierId: string;
      expectedPurchasePrice?: number;
      supplierProductCode?: string;
      isPreferred?: boolean;
    }[],
  ) {
    return this.prisma.$transaction([
      this.prisma.variantSupplier.deleteMany({ where: { variantId } }),
      this.prisma.variantSupplier.createMany({
        data: suppliers.map((s) => ({
          variantId,
          supplierId: s.supplierId,
          expectedPurchasePrice: s.expectedPurchasePrice,
          supplierProductCode: s.supplierProductCode,
          isPreferred: s.isPreferred ?? false,
        })),
      }),
    ]);
  }
}
