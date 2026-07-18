import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '../../common/constants/permissions.constants';

export const REQUIRE_PERMISSIONS_KEY = 'requiredPermissions';

export const RequirePermissions = (...permissions: PermissionCode[]) =>
    SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
