import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { UserPermissionsService } from './user-permissions.service';
import { UpsertUserPermissionDto } from './dto/upsert-user-permission.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { OverrideRoleDto } from './dto/override-role.dto';
import { RevokeAllPermissionsDto } from './dto/revoke-all-permissions.dto';
import { PermissionGroupDto } from './dto/permission-group.dto';
@Controller('rbac/users/:userId/permissions')
@RequirePermissions(PERMISSIONS.MANAGE_USER_PERMISSIONS)
export class UserPermissionsController {
    constructor(
        private readonly userPermissionsService: UserPermissionsService,
    ) {}

    @Get()
    async findAll(@Param('userId') userId: string) {
        const data = await this.userPermissionsService.findAllForUser(userId);
        return { message: 'Success', data };
    }

    @Post()
    async upsert(
        @Param('userId') userId: string,
        @Body() dto: UpsertUserPermissionDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.userPermissionsService.upsert(
            userId,
            dto,
            user.sub,
        );
        return { message: 'Permission override saved.', data };
    }

    @Post('group')
    async applyGroup(
        @Param('userId') userId: string,
        @Body() dto: PermissionGroupDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.userPermissionsService.applyPermissionGroup(
            userId,
            dto,
            user.sub,
        );
        return {
            message:
                dto.effect === 'grant'
                    ? 'Permissions granted.'
                    : 'Permissions revoked.',
            data,
        };
    }

    @Post('revoke-all')
    async revokeAll(
        @Param('userId') userId: string,
        @Body() dto: RevokeAllPermissionsDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.userPermissionsService.revokeAllRolePermissions(
            userId,
            user.sub,
            dto.reason,
        );
        return { message: 'All role permissions revoked for this user.', data };
    }

    @Post('override-role')
    async overrideRole(
        @Param('userId') userId: string,
        @Body() dto: OverrideRoleDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.userPermissionsService.overrideWithRole(
            userId,
            dto.sourceRoleId,
            user.sub,
            dto.reason,
        );
        return {
            message: 'Role permissions copied to user as overrides.',
            data,
        };
    }

    @Delete(':permissionCode')
    async remove(
        @Param('userId') userId: string,
        @Param('permissionCode') permissionCode: string,
    ) {
        await this.userPermissionsService.remove(userId, permissionCode);
        return { message: 'Permission override removed.', data: null };
    }

    @Delete()
    async reset(@Param('userId') userId: string) {
        await this.userPermissionsService.resetToDefault(userId);
        return { message: 'Permissions reset to role defaults.', data: null };
    }
}
