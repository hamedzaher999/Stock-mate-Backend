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
        if (!role) throw new NotFoundException('الدور غير موجود.');
        return role;
    }

    async create(dto: CreateRoleDto, createdById: string) {
        const existing = await this.rolesRepository.findByName(dto.name);
        if (existing)
            throw new ConflictException('يوجد دور بهذا الاسم مسبقاً.');
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
            throw new BadRequestException('لا يمكن حذف أدوار النظام الأساسية.');

        const usersCount = await this.rolesRepository.countUsersWithRole(id);
        if (usersCount > 0)
            throw new BadRequestException(
                'لا يمكن حذف دور ما زال مرتبطاً بمستخدمين.',
            );

        return this.rolesRepository.delete(id);
    }

    async setPermissions(roleId: string, dto: SetRolePermissionsDto) {
        const role = await this.findById(roleId);

        if (role.isSuperAdmin) {
            throw new BadRequestException(
                'دور المدير الخارق يمتلك كافة الصلاحيات تلقائياً - لا يمكن تعديل صلاحيات هذا الدور.',
            );
        }

        const permissions = await this.permissionsRepository.findByCodes(
            dto.permissionCodes,
        );
        if (permissions.length !== dto.permissionCodes.length) {
            throw new BadRequestException(
                'واحد أو أكثر من رموز الصلاحيات غير موجود.',
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
