import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { DepartmentsRepository } from './departments.repository';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { UpdateDepartmentStatusDto } from './dto/update-department-status.dto';
import { ListDepartmentsDto } from './dto/list-departments.dto';
import { PaginatedResult } from '../../core/interfaces/paginated-result.interface';
import { DepartmentType, Prisma } from '@prisma/client';
import { DepartmentsCacheService } from './departments-cache.service';
import { UserScopeService } from '../rbac/user-scope.service';
import { AlreadyProcessedError } from '../../common/utils/concurrency.util';
import {
    DISPOSAL_MANAGER_ROLE_NAME,
    HOSPITAL_MANAGER_ROLE_NAME,
    RECEPTION_STAFF_ROLE_NAME,
    WAREHOUSE_MANAGER_ROLE_NAME,
} from '../../common/constants/roles.constants';
const SINGLETON_TYPES: DepartmentType[] = [
    'central_warehouse',
    'pharmacy',
    'disposal_warehouse',
];
const SELECTABLE_CONTEXTS: Record<
    string,
    { unrestrictedRoles: string[]; where: Prisma.DepartmentWhereInput }
> = {
    stock: {
        unrestrictedRoles: [HOSPITAL_MANAGER_ROLE_NAME],
        where: { isActive: true, tracksInventory: true },
    },
    batches: {
        unrestrictedRoles: [HOSPITAL_MANAGER_ROLE_NAME],
        where: { isActive: true },
    },
    queue: {
        unrestrictedRoles: [RECEPTION_STAFF_ROLE_NAME],
        where: { isActive: true, type: 'standard', hasQueue: true },
    },
    'refill-requests': {
        unrestrictedRoles: [WAREHOUSE_MANAGER_ROLE_NAME],
        where: { isActive: true, type: { not: 'central_warehouse' } },
    },
    'periodic-schedules': {
        unrestrictedRoles: [WAREHOUSE_MANAGER_ROLE_NAME],
        where: { isActive: true, type: { not: 'central_warehouse' } },
    },
    disposal: {
        unrestrictedRoles: [DISPOSAL_MANAGER_ROLE_NAME],
        where: {
            isActive: true,
            tracksInventory: true,
            type: { not: 'disposal_warehouse' },
        },
    },
};
@Injectable()
export class DepartmentsService {
    constructor(
        private readonly departmentsRepository: DepartmentsRepository,
        private readonly departmentsCacheService: DepartmentsCacheService,
        private readonly userScopeService: UserScopeService,
    ) {}

    async listSelectable(requestingUserId: string, context: string) {
        const config = SELECTABLE_CONTEXTS[context];
        if (!config) {
            throw new BadRequestException(
                `Unknown department selection context "${context}".`,
            );
        }
        return this.resolveSelectable(requestingUserId, config);
    }

    private async resolveSelectable(
        requestingUserId: string,
        options: {
            unrestrictedRoles: string[];
            where: Prisma.DepartmentWhereInput;
        },
    ) {
        const scope =
            await this.userScopeService.getUserScope(requestingUserId);
        if (!scope) throw new BadRequestException('Requesting user not found.');

        const canViewAll =
            scope.isSuperAdmin ||
            options.unrestrictedRoles.includes(scope.roleName);

        if (canViewAll) {
            const departments = await this.departmentsRepository.findByFilter(
                options.where,
            );
            return { scoped: false, departments };
        }

        if (!scope.departmentId) {
            return { scoped: true, departments: [] };
        }

        const department = await this.departmentsRepository.findOneByFilter(
            scope.departmentId,
            options.where,
        );
        return { scoped: true, departments: department ? [department] : [] };
    }
    async list(dto: ListDepartmentsDto): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } = await this.departmentsRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            type: dto.type,
            isActive:
                dto.isActive === undefined
                    ? undefined
                    : dto.isActive === 'true',
            hasManager:
                dto.hasManager === undefined
                    ? undefined
                    : dto.hasManager === 'true',
            search: dto.search,
        });

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findById(id: string) {
        const department = await this.departmentsRepository.findById(id);
        if (!department) throw new NotFoundException('القسم غير موجود.');
        return department;
    }

    async create(dto: CreateDepartmentDto) {
        const existing = await this.departmentsRepository.findByName(dto.name);
        if (existing)
            throw new ConflictException('يوجد قسم بنفس الاسم بالفعل.');

        if (dto.managerId) {
            await this.assertValidManagerCandidate(dto.managerId);
        }

        let department: Awaited<
            ReturnType<typeof this.departmentsRepository.create>
        >;
        try {
            department = SINGLETON_TYPES.includes(dto.type)
                ? await this.departmentsRepository.createSingleton({
                      name: dto.name,
                      type: dto.type,
                      managerId: dto.managerId,
                      hasQueue: dto.hasQueue,
                  })
                : await this.departmentsRepository.create({
                      name: dto.name,
                      type: dto.type,
                      managerId: dto.managerId,
                      hasQueue: dto.hasQueue,
                  });
        } catch (error) {
            if (error instanceof AlreadyProcessedError) {
                throw new ConflictException(error.message);
            }
            throw error;
        }

        if (dto.managerId) {
            const staleDepartment =
                await this.departmentsRepository.findCurrentManagedDepartment(
                    dto.managerId,
                );
            if (staleDepartment && staleDepartment.id !== department.id) {
                await this.departmentsRepository.clearManager(
                    staleDepartment.id,
                );
                await this.departmentsCacheService.invalidate(
                    staleDepartment.id,
                    staleDepartment.type,
                );
            }

            await this.departmentsRepository.setUserDepartment(
                dto.managerId,
                department.id,
            );
            await this.userScopeService.invalidate(dto.managerId);
        }

        await this.departmentsCacheService.invalidate(
            department.id,
            department.type,
        );

        return department;
    }
    async update(id: string, dto: UpdateDepartmentDto) {
        const existing = await this.findById(id);

        if (dto.name) {
            const found = await this.departmentsRepository.findByName(dto.name);
            if (found && found.id !== id) {
                throw new ConflictException('يوجد قسم بنفس الاسم بالفعل.');
            }
        }

        const updated = await this.departmentsRepository.update(id, dto);
        await this.departmentsCacheService.invalidate(id, existing.type);
        return updated;
    }

    async updateStatus(id: string, dto: UpdateDepartmentStatusDto) {
        const department = await this.findById(id);

        if (!dto.isActive && SINGLETON_TYPES.includes(department.type)) {
            throw new BadRequestException(
                `The ${department.type.replace('_', ' ')} cannot be deactivated -- it is required for core operations.`,
            );
        }

        const updated = await this.departmentsRepository.updateStatus(
            id,
            dto.isActive,
            dto.hasQueue,
        );
        await this.departmentsCacheService.invalidate(id, department.type);
        return updated;
    }

    async assignManager(id: string, dto: AssignManagerDto) {
        const department = await this.findById(id);
        const previousManagerId = department.managerId;

        if (!dto.managerId) {
            const updated = await this.departmentsRepository.setManager(
                id,
                null,
            );
            if (previousManagerId) {
                await this.userScopeService.invalidate(previousManagerId);
            }
            return updated;
        }

        await this.assertValidManagerCandidate(dto.managerId);

        const staleDepartment =
            await this.departmentsRepository.findCurrentManagedDepartment(
                dto.managerId,
            );
        if (staleDepartment && staleDepartment.id !== id) {
            await this.departmentsRepository.clearManager(staleDepartment.id);
            await this.departmentsCacheService.invalidate(
                staleDepartment.id,
                staleDepartment.type,
            );
        }

        const updated = await this.departmentsRepository.setManager(
            id,
            dto.managerId,
        );
        await this.departmentsRepository.setUserDepartment(dto.managerId, id);
        await this.userScopeService.invalidate(dto.managerId);
        if (previousManagerId && previousManagerId !== dto.managerId) {
            await this.userScopeService.invalidate(previousManagerId);
        }
        await this.departmentsCacheService.invalidate(id, department.type);

        return updated;
    }

    private async assertValidManagerCandidate(userId: string) {
        const user = await this.departmentsRepository.findUserById(userId);
        if (!user) throw new BadRequestException('المدير المعين غير موجود.');
        if (user.status !== 'active')
            throw new BadRequestException(
                'يجب أن يكون المدير المعين مستخدماً نشطاً.',
            );
    }
}
