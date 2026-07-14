import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma, DepartmentType } from '@prisma/client';

const departmentSelect = {
  id: true,
  name: true,
  type: true,
  isActive: true,
  managerId: true,
  manager: { select: { id: true, fullName: true, phone: true, email: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DepartmentSelect;

@Injectable()
export class DepartmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    skip: number;
    take: number;
    type?: DepartmentType;
    isActive?: boolean;
    search?: string;
  }) {
    const where: Prisma.DepartmentWhereInput = {
      type: params.type,
      isActive: params.isActive,
      ...(params.search && {
        name: { contains: params.search, mode: 'insensitive' },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({
        where,
        select: departmentSelect,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.department.count({ where }),
    ]);

    return { items, total };
  }

  findById(id: string) {
    return this.prisma.department.findUnique({
      where: { id },
      select: departmentSelect,
    });
  }

  findByName(name: string) {
    return this.prisma.department.findUnique({ where: { name } });
  }

  countByType(type: DepartmentType) {
    return this.prisma.department.count({ where: { type } });
  }

  create(data: { name: string; type: DepartmentType; managerId?: string }) {
    return this.prisma.department.create({ data, select: departmentSelect });
  }

  update(id: string, data: { name?: string }) {
    return this.prisma.department.update({
      where: { id },
      data,
      select: departmentSelect,
    });
  }

  updateStatus(id: string, isActive: boolean) {
    return this.prisma.department.update({
      where: { id },
      data: { isActive },
      select: departmentSelect,
    });
  }

  setManager(id: string, managerId: string | null) {
    return this.prisma.department.update({
      where: { id },
      data: { managerId },
      select: departmentSelect,
    });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  setUserDepartment(userId: string, departmentId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { departmentId },
    });
  }
}
