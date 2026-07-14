import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const supplierSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SupplierSelect;

@Injectable()
export class SuppliersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    skip: number;
    take: number;
    isActive?: boolean;
    search?: string;
  }) {
    const where: Prisma.SupplierWhereInput = {
      isActive: params.isActive,
      ...(params.search && {
        name: { contains: params.search, mode: 'insensitive' },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        select: supplierSelect,
        skip: params.skip,
        take: params.take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { items, total };
  }

  findById(id: string) {
    return this.prisma.supplier.findUnique({
      where: { id },
      select: supplierSelect,
    });
  }

  findByName(name: string) {
    return this.prisma.supplier.findFirst({ where: { name } });
  }

  create(data: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  }) {
    return this.prisma.supplier.create({ data, select: supplierSelect });
  }

  update(
    id: string,
    data: { name?: string; phone?: string; email?: string; address?: string },
  ) {
    return this.prisma.supplier.update({
      where: { id },
      data,
      select: supplierSelect,
    });
  }

  updateStatus(id: string, isActive: boolean) {
    return this.prisma.supplier.update({
      where: { id },
      data: { isActive },
      select: supplierSelect,
    });
  }
}
