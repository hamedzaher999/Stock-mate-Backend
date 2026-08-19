import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { PermissionsResolverService } from '../rbac/permissions-resolver.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { PaginatedResult } from '../../core/interfaces/paginated-result.interface';
import {
    DOCTOR_ROLE_NAME,
    HOSPITAL_MANAGER_ROLE_NAME,
} from '../../common/constants/roles.constants';
import { UserScopeService } from '../rbac/user-scope.service';
import { SessionsService } from '../auth/sessions/sessions.service';
@Injectable()
export class UsersService {
    constructor(
        private readonly usersRepository: UsersRepository,
        private readonly permissionsResolver: PermissionsResolverService,
        private readonly userScopeService: UserScopeService,
        private readonly sessionsService: SessionsService,
    ) {}

    async list(dto: ListUsersDto): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } = await this.usersRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            departmentId: dto.departmentId,
            roleId: dto.roleId,
            status: dto.status,
            search: dto.search,
            availableAsManager:
                dto.availableAsManager === undefined
                    ? undefined
                    : dto.availableAsManager === 'true',
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
        const user = await this.usersRepository.findById(id);
        if (!user) throw new NotFoundException('المستخدم غير موجود.');
        return user;
    }

    async getWithPermissions(id: string) {
        const user = await this.findById(id);
        const permissions =
            await this.permissionsResolver.getEffectivePermissions(id);
        return { ...user, permissions: Array.from(permissions) };
    }

    async create(dto: CreateUserDto, createdById: string) {
        const role = await this.usersRepository.findRoleById(dto.roleId);
        if (!role) throw new BadRequestException('الدور غير موجود.');
        if (!role.isActive)
            throw new BadRequestException('لا يمكن تعيين دور غير نشط.');

        if (role.name === HOSPITAL_MANAGER_ROLE_NAME) {
            throw new ConflictException(
                'حساب مدير المستشفى هو حساب رئيسي ثابت وفريد ولا يمكن إنشاؤه.',
            );
        }

        if (dto.departmentId) {
            const department = await this.usersRepository.departmentExists(
                dto.departmentId,
            );
            if (!department) throw new BadRequestException('القسم غير موجود.');
        }

        if (role.name === DOCTOR_ROLE_NAME) {
            if (!dto.departmentId)
                throw new BadRequestException('يجب تعيين الأطباء إلى قسم.');
            if (!dto.specialty)
                throw new BadRequestException('يجب تحديد تخصص للأطباء.');
        }

        const duplicate = await this.usersRepository.findByPhoneOrEmail(
            dto.phone,
            dto.email,
        );
        if (duplicate)
            throw new ConflictException(
                'يوجد مستخدم برقم الهاتف أو البريد الإلكتروني هذا مسبقاً.',
            );

        return this.usersRepository.create({
            fullName: dto.fullName,
            phone: dto.phone,
            email: dto.email,
            roleId: dto.roleId,
            departmentId: dto.departmentId,
            specialty: dto.specialty,
            createdById,
        });
    }

    async update(id: string, dto: UpdateUserDto) {
        const existing = await this.findById(id);

        if (
            existing.role.name === HOSPITAL_MANAGER_ROLE_NAME &&
            dto.roleId &&
            dto.roleId !== existing.roleId
        ) {
            throw new BadRequestException(
                'لا يمكن تغيير دور حساب مدير المستشفى.',
            );
        }

        if (dto.roleId) {
            const role = await this.usersRepository.findRoleById(dto.roleId);
            if (!role) throw new BadRequestException('الدور غير موجود.');
            if (!role.isActive)
                throw new BadRequestException('لا يمكن تعيين دور غير نشط.');

            if (role.name === HOSPITAL_MANAGER_ROLE_NAME) {
                throw new ConflictException(
                    'لا يمكن تعيين دور مدير المستشفى -- فهو حساب رئيسي ثابت وفريد.',
                );
            }

            const willBeDoctor = role.name === DOCTOR_ROLE_NAME;
            const effectiveDepartmentId =
                dto.departmentId ?? existing.departmentId;
            const effectiveSpecialty = dto.specialty ?? existing.specialty;

            if (
                willBeDoctor &&
                (!effectiveDepartmentId || !effectiveSpecialty)
            ) {
                throw new BadRequestException(
                    'يجب أن يمتلك الأطباء قسماً وتخصصاً معاً.',
                );
            }
        }

        if (dto.departmentId) {
            const department = await this.usersRepository.departmentExists(
                dto.departmentId,
            );
            if (!department) throw new BadRequestException('القسم غير موجود.');
        }

        if (dto.phone || dto.email) {
            const duplicate =
                await this.usersRepository.findByPhoneOrEmailExcluding(
                    id,
                    dto.phone,
                    dto.email,
                );
            if (duplicate)
                throw new ConflictException(
                    'يوجد مستخدم برقم الهاتف أو البريد الإلكتروني هذا مسبقاً.',
                );
        }

        const updated = await this.usersRepository.update(id, dto);

        if (dto.roleId) {
            await this.permissionsResolver.invalidate(id);
        }
        if (dto.roleId || dto.departmentId) {
            await this.userScopeService.invalidate(id);
        }

        return updated;
    }

    async updateStatus(
        id: string,
        dto: UpdateUserStatusDto,
        requestingUserId: string,
    ) {
        if (id === requestingUserId && dto.status === 'inactive') {
            throw new ForbiddenException('لا يمكنك إلغاء تنشيط حسابك الشخصي.');
        }

        const target = await this.findById(id);

        if (
            target.role.name === HOSPITAL_MANAGER_ROLE_NAME &&
            dto.status === 'inactive'
        ) {
            throw new ForbiddenException(
                'لا يمكن أبداً إلغاء تنشيط حساب مدير المستشفى.',
            );
        }

        const updated = await this.usersRepository.updateStatus(id, dto.status);

        if (dto.status === 'inactive') {
            await this.sessionsService.revokeAllForUser(id);
        }

        return updated;
    }

    async updateMe(userId: string, dto: UpdateMeDto) {
        if (!dto.phone && !dto.email) {
            throw new BadRequestException(
                'يرجى توفير رقم هاتف أو بريد إلكتروني للتحديث.',
            );
        }

        const duplicate =
            await this.usersRepository.findByPhoneOrEmailExcluding(
                userId,
                dto.phone,
                dto.email,
            );
        if (duplicate)
            throw new ConflictException(
                'يوجد مستخدم برقم الهاتف أو البريد الإلكتروني هذا مسبقاً.',
            );

        return this.usersRepository.update(userId, dto);
    }
    async listSessionsForUser(userId: string) {
        await this.findById(userId);
        return this.sessionsService.listActiveSessions(userId);
    }

    async revokeSessionForUser(userId: string, sessionId: string) {
        await this.findById(userId);
        await this.sessionsService.revokeSessionForUser(sessionId, userId);
    }

    async revokeAllSessionsForUser(userId: string) {
        await this.findById(userId);
        return this.sessionsService.revokeAllForUser(userId);
    }
}
