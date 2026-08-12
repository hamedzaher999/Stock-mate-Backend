import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '../../common/constants/permissions.constants';

export const REQUIRE_ANY_PERMISSIONS_KEY = 'requireAnyPermissions';

export const RequireAnyPermissions = (...permissions: PermissionCode[]) =>
    SetMetadata(REQUIRE_ANY_PERMISSIONS_KEY, permissions);
