import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Put,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('rbac/roles')
@RequirePermissions(PERMISSIONS.MANAGE_ROLES)
export class RolesController {
    constructor(private readonly rolesService: RolesService) {}

    @Get()
    async findAll() {
        const data = await this.rolesService.findAll();
        return { message: 'Success', data };
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const data = await this.rolesService.findById(id);
        return { message: 'Success', data };
    }

    @Post()
    async create(
        @Body() dto: CreateRoleDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.rolesService.create(dto, user.sub);
        return { message: 'Role created.', data };
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
        const data = await this.rolesService.update(id, dto);
        return { message: 'Role updated.', data };
    }

    @Put(':id/permissions')
    async setPermissions(
        @Param('id') id: string,
        @Body() dto: SetRolePermissionsDto,
    ) {
        const data = await this.rolesService.setPermissions(id, dto);
        return { message: 'Role permissions updated.', data };
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        await this.rolesService.delete(id);
        return { message: 'Role deleted.', data: null };
    }
}
