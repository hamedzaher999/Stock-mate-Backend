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

@Injectable()
export class UserPermissionsService {
  constructor(
    private readonly userPermissionsRepository: UserPermissionsRepository,
    private readonly permissionsRepository: PermissionsRepository,
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
      throw new BadRequestException('You cannot revoke your own permissions.');
    }

    const target =
      await this.userPermissionsRepository.findUserRole(targetUserId);
    if (!target) throw new NotFoundException('User not found.');
    if (target.role.name === HOSPITAL_MANAGER_ROLE_NAME) {
      throw new BadRequestException(
        'The Hospital Manager account already has full access -- overrides do not apply to it.',
      );
    }

    const [permission] = await this.permissionsRepository.findByCodes([
      dto.permissionCode,
    ]);
    if (!permission) throw new NotFoundException('Permission code not found.');

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
    const [permission] = await this.permissionsRepository.findByCodes([
      permissionCode,
    ]);
    if (!permission) throw new NotFoundException('Permission code not found.');

    await this.userPermissionsRepository.delete(targetUserId, permission.id);
    await this.permissionsResolver.invalidate(targetUserId);
    return { removed: true };
  }

  async resetToDefault(targetUserId: string) {
    const target =
      await this.userPermissionsRepository.findUserRole(targetUserId);
    if (!target) throw new NotFoundException('User not found.');
    if (target.role.name === HOSPITAL_MANAGER_ROLE_NAME) {
      throw new BadRequestException(
        'The Hospital Manager account always has full access -- there is nothing to reset.',
      );
    }

    await this.userPermissionsRepository.deleteAllForUser(targetUserId);
    await this.permissionsResolver.invalidate(targetUserId);
    return { reset: true };
  }
}
