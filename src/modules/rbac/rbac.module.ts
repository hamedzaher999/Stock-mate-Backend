import { Module } from '@nestjs/common';
import { RolesController } from './roles/roles.controller';
import { RolesService } from './roles/roles.service';
import { RolesRepository } from './roles/roles.repository';
import { PermissionsController } from './permissions/permissions.controller';
import { PermissionsService } from './permissions/permissions.service';
import { PermissionsRepository } from './permissions/permissions.repository';
import { UserPermissionsController } from './user-permissions/user-permissions.controller';
import { UserPermissionsService } from './user-permissions/user-permissions.service';
import { UserPermissionsRepository } from './user-permissions/user-permissions.repository';
import { PermissionsResolverService } from './permissions-resolver.service';
import { UserScopeService } from './user-scope.service';
@Module({
    controllers: [
        RolesController,
        PermissionsController,
        UserPermissionsController,
    ],
    providers: [
        RolesService,
        RolesRepository,
        PermissionsService,
        PermissionsRepository,
        UserPermissionsService,
        UserPermissionsRepository,
        PermissionsResolverService,
        UserScopeService,
    ],
    exports: [PermissionsResolverService, UserScopeService],
})
export class RbacModule {}
