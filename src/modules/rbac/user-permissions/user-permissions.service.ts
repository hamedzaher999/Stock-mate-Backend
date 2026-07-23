import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { UserPermissionsRepository } from './user-permissions.repository';
import { PermissionsRepository } from '../permissions/permissions.repository';
import { PermissionsResolverService } from '../permissions-resolver.service';
import { UpsertUserPermissionDto } from './dto/upsert-user-permission.dto';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../../common/constants/roles.constants';
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
        if (targetUserId === grantedById && dto.effect === 'revoke') {
            throw new BadRequestException(
                'You cannot revoke your own permissions.',
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

    async remove(targetUserId: string, permissionCode: string) {
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

    async resetToDefault(targetUserId: string) {
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
        if (targetUserId === requesterId && dto.effect === 'revoke') {
            throw new BadRequestException(
                'You cannot revoke your own permissions.',
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

    /**
     * Revokes every permission the user's role would normally grant, and
     * clears any stray grant overrides too, so the end state is genuinely
     * zero permissions -- not "zero role permissions but still holding
     * some unrelated grant".
     */
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

    /**
     * Copies another role's permission set onto this user as grant
     * overrides -- e.g. give a doctor every warehouse-role permission
     * without granting them one by one. Permissions already covered by
     * the user's own role are skipped (any stray revoke on them is
     * cleared instead, so the default takes effect cleanly).
     */
    async overrideWithRole(
        targetUserId: string,
        sourceRoleId: string,
        requesterId: string,
        reason?: string,
    ) {
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
        if (target.role.name === HOSPITAL_MANAGER_ROLE_NAME) {
            throw new BadRequestException(
                'The Hospital Manager account already has full access -- overrides do not apply to it.',
            );
        }
        return target;
    }
}
