import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { UserPermissionsRepository } from './user-permissions.repository';
import { PermissionsRepository } from '../permissions/permissions.repository';
import { PermissionsResolverService } from '../permissions-resolver.service';
import { UpsertUserPermissionDto } from './dto/upsert-user-permission.dto';
import { RolesRepository } from '../roles/roles.repository';
import { PermissionGroupDto } from './dto/permission-group.dto';
@Injectable()
export class UserPermissionsService {
    constructor(
        private readonly userPermissionsRepository: UserPermissionsRepository,
        private readonly permissionsRepository: PermissionsRepository,
        private readonly rolesRepository: RolesRepository,
        private readonly permissionsResolver: PermissionsResolverService,
    ) {}

    async findAllForUser(userId: string) {
        const [overrides, effectivePermissions] = await Promise.all([
            this.userPermissionsRepository.findAllForUser(userId),
            this.permissionsResolver.getEffectivePermissions(userId),
        ]);
        return {
            overrides,
            effectivePermissions: Array.from(effectivePermissions),
        };
    }

    async upsert(
        targetUserId: string,
        dto: UpsertUserPermissionDto,
        grantedById: string,
    ) {
        if (targetUserId === grantedById) {
            throw new BadRequestException(
                'You cannot modify your own permission overrides.',
            );
        }

        await this.assertManageableTarget(targetUserId);

        const [permission] = await this.permissionsRepository.findByCodes([
            dto.permissionCode,
        ]);
        if (!permission)
            throw new NotFoundException('Permission code not found.');

        const result = await this.userPermissionsRepository.upsert({
            userId: targetUserId,
            permissionId: permission.id,
            effect: dto.effect,
            grantedById,
            reason: dto.reason,
        });

        await this.permissionsResolver.invalidate(targetUserId);
        return result;
    }

    async remove(
        targetUserId: string,
        permissionCode: string,
        requestingUserId: string,
    ) {
        if (targetUserId === requestingUserId) {
            throw new BadRequestException(
                'You cannot modify your own permission overrides.',
            );
        }

        await this.assertManageableTarget(targetUserId);

        const [permission] = await this.permissionsRepository.findByCodes([
            permissionCode,
        ]);
        if (!permission)
            throw new NotFoundException('Permission code not found.');

        await this.userPermissionsRepository.delete(
            targetUserId,
            permission.id,
        );
        await this.permissionsResolver.invalidate(targetUserId);
        return { removed: true };
    }

    async resetToDefault(targetUserId: string, requestingUserId: string) {
        if (targetUserId === requestingUserId) {
            throw new BadRequestException(
                'You cannot reset your own permission overrides.',
            );
        }

        await this.assertManageableTarget(targetUserId);

        await this.userPermissionsRepository.deleteAllForUser(targetUserId);
        await this.permissionsResolver.invalidate(targetUserId);
        return { reset: true };
    }

    async applyPermissionGroup(
        targetUserId: string,
        dto: PermissionGroupDto,
        requesterId: string,
    ) {
        if (targetUserId === requesterId) {
            throw new BadRequestException(
                'You cannot modify your own permission overrides.',
            );
        }

        const target = await this.assertManageableTarget(targetUserId);

        const permissions = await this.permissionsRepository.findByCodes(
            dto.permissionCodes,
        );
        if (permissions.length !== dto.permissionCodes.length) {
            throw new BadRequestException(
                'One or more permission codes do not exist.',
            );
        }

        const roleDefaultCodes = new Set(
            await this.userPermissionsRepository.findRolePermissionCodes(
                target.role.id,
            ),
        );

        for (const permission of permissions) {
            const isDefault = roleDefaultCodes.has(permission.code);
            const needsOverride =
                (dto.effect === 'grant' && !isDefault) ||
                (dto.effect === 'revoke' && isDefault);

            if (needsOverride) {
                await this.userPermissionsRepository.upsert({
                    userId: targetUserId,
                    permissionId: permission.id,
                    effect: dto.effect,
                    grantedById: requesterId,
                    reason: dto.reason,
                });
            } else {
                await this.userPermissionsRepository.removeIfExists(
                    targetUserId,
                    permission.id,
                );
            }
        }

        await this.permissionsResolver.invalidate(targetUserId);
        return this.findAllForUser(targetUserId);
    }

    async revokeAllRolePermissions(
        targetUserId: string,
        requesterId: string,
        reason?: string,
    ) {
        if (targetUserId === requesterId) {
            throw new BadRequestException(
                'You cannot revoke all of your own permissions.',
            );
        }

        const target = await this.assertManageableTarget(targetUserId);

        await this.userPermissionsRepository.deleteAllForUser(targetUserId);

        const roleDefaultCodes =
            await this.userPermissionsRepository.findRolePermissionCodes(
                target.role.id,
            );

        if (roleDefaultCodes.length > 0) {
            const permissions =
                await this.permissionsRepository.findByCodes(roleDefaultCodes);
            await this.userPermissionsRepository.createManyRevoked(
                targetUserId,
                permissions.map((p) => p.id),
                requesterId,
                reason,
            );
        }

        await this.permissionsResolver.invalidate(targetUserId);
        return this.findAllForUser(targetUserId);
    }

    async overrideWithRole(
        targetUserId: string,
        sourceRoleId: string,
        requesterId: string,
        reason?: string,
    ) {
        if (targetUserId === requesterId) {
            throw new BadRequestException(
                'You cannot copy role permissions onto your own account.',
            );
        }

        const target = await this.assertManageableTarget(targetUserId);

        const sourceRole = await this.rolesRepository.findById(sourceRoleId);
        if (!sourceRole)
            throw new BadRequestException('Source role does not exist.');

        const sourceCodes =
            await this.userPermissionsRepository.findRolePermissionCodes(
                sourceRoleId,
            );
        if (sourceCodes.length === 0) {
            return this.findAllForUser(targetUserId);
        }

        const targetRoleDefaultCodes = new Set(
            await this.userPermissionsRepository.findRolePermissionCodes(
                target.role.id,
            ),
        );

        const permissions =
            await this.permissionsRepository.findByCodes(sourceCodes);

        for (const permission of permissions) {
            if (targetRoleDefaultCodes.has(permission.code)) {
                await this.userPermissionsRepository.removeIfExists(
                    targetUserId,
                    permission.id,
                );
                continue;
            }

            await this.userPermissionsRepository.upsert({
                userId: targetUserId,
                permissionId: permission.id,
                effect: 'grant',
                grantedById: requesterId,
                reason: reason ?? `Copied from role "${sourceRole.name}"`,
            });
        }

        await this.permissionsResolver.invalidate(targetUserId);
        return this.findAllForUser(targetUserId);
    }

    private async assertManageableTarget(targetUserId: string) {
        const target =
            await this.userPermissionsRepository.findUserRole(targetUserId);
        if (!target) throw new NotFoundException('User not found.');
        if (target.role.isSuperAdmin) {
            throw new BadRequestException(
                'The super-admin account already has full access -- overrides do not apply to it.',
            );
        }
        return target;
    }
}
