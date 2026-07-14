import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserPermissionsRepository } from './user-permissions.repository';
import { PermissionsRepository } from '../permissions/permissions.repository';
import { PermissionsResolverService } from '../permissions-resolver.service';
import { UpsertUserPermissionDto } from './dto/upsert-user-permission.dto';

@Injectable()
export class UserPermissionsService {
  constructor(
    private readonly userPermissionsRepository: UserPermissionsRepository,
    private readonly permissionsRepository: PermissionsRepository,
    private readonly permissionsResolver: PermissionsResolverService,
  ) {}

  findAllForUser(userId: string) {
    return this.userPermissionsRepository.findAllForUser(userId);
  }

  async upsert(
    targetUserId: string,
    dto: UpsertUserPermissionDto,
    grantedById: string,
  ) {
    if (targetUserId === grantedById && dto.effect === 'revoke') {
      throw new BadRequestException('You cannot revoke your own permissions.');
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
}
