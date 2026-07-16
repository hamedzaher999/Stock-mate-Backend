import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const stockSettingSelect = {
  id: true,
  variantId: true,
  departmentId: true,
  storageLocation: true,
  minimumStock: true,
  maximumStock: true,
  isActive: true,
  variant: { select: { id: true, variantName: true, sku: true } },
  department: { select: { id: true, name: true, type: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DepartmentStockSettingSelect;

@Injectable()
export class StockSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    skip: number;
    take: number;
    departmentId?: string;
    variantId?: string;
    isActive?: boolean;
  }) {
    const where: Prisma.DepartmentStockSettingWhereInput = {
      departmentId: params.departmentId,
      variantId: params.variantId,
      isActive: params.isActive,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.departmentStockSetting.findMany({
        where,
        select: stockSettingSelect,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.departmentStockSetting.count({ where }),
    ]);

    return { items, total };
  }

  findById(id: string) {
    return this.prisma.departmentStockSetting.findUnique({
      where: { id },
      select: stockSettingSelect,
    });
  }

  findByVariantAndDepartment(variantId: string, departmentId: string) {
    return this.prisma.departmentStockSetting.findUnique({
      where: { variantId_departmentId: { variantId, departmentId } },
    });
  }

  variantExists(id: string) {
    return this.prisma.productVariant.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true,
        product: { select: { isActive: true } },
      },
    });
  }

  departmentExists(id: string) {
    return this.prisma.department.findUnique({
      where: { id },
      select: { id: true, type: true, isActive: true },
    });
  }

  findRequestingUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, role: { select: { name: true } } },
    });
  }

  create(data: {
    variantId: string;
    departmentId: string;
    storageLocation?: string;
    minimumStock?: number;
    maximumStock?: number;
    createdById: string;
  }) {
    return this.prisma.departmentStockSetting.create({
      data,
      select: stockSettingSelect,
    });
  }

  update(
    id: string,
    data: {
      storageLocation?: string;
      minimumStock?: number;
      maximumStock?: number;
    },
  ) {
    return this.prisma.departmentStockSetting.update({
      where: { id },
      data,
      select: stockSettingSelect,
    });
  }

  updateStatus(id: string, isActive: boolean) {
    return this.prisma.departmentStockSetting.update({
      where: { id },
      data: { isActive },
      select: stockSettingSelect,
    });
  }

  delete(id: string) {
    return this.prisma.departmentStockSetting.delete({ where: { id } });
  }
}
