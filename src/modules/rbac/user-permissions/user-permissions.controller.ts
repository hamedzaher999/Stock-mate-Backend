import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { UserPermissionsService } from './user-permissions.service';
import { UpsertUserPermissionDto } from './dto/upsert-user-permission.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

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

  @Delete(':permissionCode')
  async remove(
    @Param('userId') userId: string,
    @Param('permissionCode') permissionCode: string,
  ) {
    await this.userPermissionsService.remove(userId, permissionCode);
    return { message: 'Permission override removed.', data: null };
  }
}
