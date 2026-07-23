import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PermissionEffect } from '@prisma/client';
@Injectable()
export class UserPermissionsRepository {
    constructor(private readonly prisma: PrismaService) {}

    findAllForUser(userId: string) {
        return this.prisma.userPermission.findMany({
            where: { userId },
            include: {
                permission: true,
                grantedBy: { select: { id: true, fullName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    upsert(data: {
        userId: string;
        permissionId: string;
        effect: PermissionEffect;
        grantedById: string;
        reason?: string;
    }) {
        return this.prisma.userPermission.upsert({
            where: {
                userId_permissionId: {
                    userId: data.userId,
                    permissionId: data.permissionId,
                },
            },
            update: {
                effect: data.effect,
                grantedById: data.grantedById,
                reason: data.reason,
            },
            create: data,
        });
    }

    delete(userId: string, permissionId: string) {
        return this.prisma.userPermission.delete({
            where: { userId_permissionId: { userId, permissionId } },
        });
    }

    // Same as delete(), but safe to call when no row exists -- used by the
    // group/override logic where "no override needed" is a valid outcome.
    removeIfExists(userId: string, permissionId: string) {
        return this.prisma.userPermission.deleteMany({
            where: { userId, permissionId },
        });
    }

    deleteAllForUser(userId: string) {
        return this.prisma.userPermission.deleteMany({ where: { userId } });
    }

    createManyRevoked(
        userId: string,
        permissionIds: string[],
        grantedById: string,
        reason?: string,
    ) {
        return this.prisma.userPermission.createMany({
            data: permissionIds.map((permissionId) => ({
                userId,
                permissionId,
                effect: 'revoke',
                grantedById,
                reason,
            })),
        });
    }

    findUserRole(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: { select: { id: true, name: true } } },
        });
    }

    findRolePermissionCodes(roleId: string): Promise<string[]> {
        return this.prisma.rolePermission
            .findMany({
                where: { roleId },
                select: { permission: { select: { code: true } } },
            })
            .then((rows) => rows.map((r) => r.permission.code));
    }
}
