import { Controller, Get } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('rbac/permissions')
export class PermissionsController {
    constructor(private readonly permissionsService: PermissionsService) {}

    @Get()
    @RequirePermissions(PERMISSIONS.MANAGE_ROLES)
    async findAll() {
        const data = await this.permissionsService.findAll();
        return { message: 'Success', data };
    }
}
