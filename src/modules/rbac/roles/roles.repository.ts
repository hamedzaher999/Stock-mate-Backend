import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  findByName(name: string) {
    return this.prisma.role.findUnique({ where: { name } });
  }

  create(data: { name: string; description?: string; createdById: string }) {
    return this.prisma.role.create({ data });
  }

  update(id: string, data: { description?: string; isActive?: boolean }) {
    return this.prisma.role.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.role.delete({ where: { id } });
  }

  setPermissions(roleId: string, permissionIds: string[]) {
    return this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      }),
    ]);
  }

  countUsersWithRole(roleId: string) {
    return this.prisma.user.count({ where: { roleId } });
  }
}
