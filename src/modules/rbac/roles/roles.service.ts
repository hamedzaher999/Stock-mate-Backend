import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { RolesRepository } from './roles.repository';
import { PermissionsRepository } from '../permissions/permissions.repository';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../../common/constants/roles.constants';
import { PermissionsResolverService } from '../permissions-resolver.service';
@Injectable()
export class RolesService {
    constructor(
        private readonly rolesRepository: RolesRepository,
        private readonly permissionsRepository: PermissionsRepository,
        private readonly permissionsResolver: PermissionsResolverService,
    ) {}

    findAll() {
        return this.rolesRepository.findAll();
    }

    async findById(id: string) {
        const role = await this.rolesRepository.findById(id);
        if (!role) throw new NotFoundException('Role not found.');
        return role;
    }

    async create(dto: CreateRoleDto, createdById: string) {
        const existing = await this.rolesRepository.findByName(dto.name);
        if (existing)
            throw new ConflictException(
                'A role with this name already exists.',
            );
        return this.rolesRepository.create({
            name: dto.name,
            description: dto.description,
            createdById,
        });
    }

    async update(id: string, dto: UpdateRoleDto) {
        await this.findById(id);
        const updated = await this.rolesRepository.update(id, dto);
        await this.invalidatePermissionsForRole(id);
        return updated;
    }

    async delete(id: string) {
        const role = await this.findById(id);
        if (role.isSystem)
            throw new BadRequestException(
                'Built-in system roles cannot be deleted.',
            );

        const usersCount = await this.rolesRepository.countUsersWithRole(id);
        if (usersCount > 0)
            throw new BadRequestException(
                'Cannot delete a role that is still assigned to users.',
            );

        return this.rolesRepository.delete(id);
    }

    async setPermissions(roleId: string, dto: SetRolePermissionsDto) {
        const role = await this.findById(roleId);

        if (role.name === HOSPITAL_MANAGER_ROLE_NAME) {
            throw new BadRequestException(
                'The Hospital Manager role automatically has every permission -- its role_permissions cannot be edited.',
            );
        }

        const permissions = await this.permissionsRepository.findByCodes(
            dto.permissionCodes,
        );
        if (permissions.length !== dto.permissionCodes.length) {
            throw new BadRequestException(
                'One or more permission codes do not exist.',
            );
        }

        await this.rolesRepository.setPermissions(
            roleId,
            permissions.map((p) => p.id),
        );
        await this.invalidatePermissionsForRole(roleId);
        return this.findById(roleId);
    }

    private async invalidatePermissionsForRole(roleId: string) {
        const users = await this.rolesRepository.findUserIdsByRole(roleId);
        await Promise.all(
            users.map((u) => this.permissionsResolver.invalidate(u.id)),
        );
    }
}
