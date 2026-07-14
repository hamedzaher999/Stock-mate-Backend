import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const userWithRoleSelect = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  specialty: true,
  status: true,
  roleId: true,
  departmentId: true,
  role: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByIdentifier(identifier: { phone?: string; email?: string }) {
    const conditions: Prisma.UserWhereInput[] = [];
    if (identifier.phone) conditions.push({ phone: identifier.phone });
    if (identifier.email) conditions.push({ email: identifier.email });
    if (conditions.length === 0) return Promise.resolve(null);

    return this.prisma.user.findFirst({ where: { OR: conditions } });
  }

  findUserWithRoleById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: userWithRoleSelect,
    });
  }
}
