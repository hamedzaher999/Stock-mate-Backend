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

const DOCTOR_ROLE_NAME = 'doctor';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly permissionsResolver: PermissionsResolverService,
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
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async create(dto: CreateUserDto, createdById: string) {
    const role = await this.usersRepository.findRoleById(dto.roleId);
    if (!role) throw new BadRequestException('Role does not exist.');

    if (dto.departmentId) {
      const department = await this.usersRepository.departmentExists(
        dto.departmentId,
      );
      if (!department)
        throw new BadRequestException('Department does not exist.');
    }

    if (role.name === DOCTOR_ROLE_NAME) {
      if (!dto.departmentId)
        throw new BadRequestException(
          'Doctors must be assigned to a department.',
        );
      if (!dto.specialty)
        throw new BadRequestException(
          'Doctors must have a specialty specified.',
        );
    }

    const duplicate = await this.usersRepository.findByPhoneOrEmail(
      dto.phone,
      dto.email,
    );
    if (duplicate)
      throw new ConflictException(
        'A user with this phone or email already exists.',
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

    if (dto.roleId) {
      const role = await this.usersRepository.findRoleById(dto.roleId);
      if (!role) throw new BadRequestException('Role does not exist.');

      const willBeDoctor = role.name === DOCTOR_ROLE_NAME;
      const effectiveDepartmentId = dto.departmentId ?? existing.departmentId;
      const effectiveSpecialty = dto.specialty ?? existing.specialty;

      if (willBeDoctor && (!effectiveDepartmentId || !effectiveSpecialty)) {
        throw new BadRequestException(
          'Doctors must have both a department and a specialty.',
        );
      }
    }

    if (dto.departmentId) {
      const department = await this.usersRepository.departmentExists(
        dto.departmentId,
      );
      if (!department)
        throw new BadRequestException('Department does not exist.');
    }

    if (dto.phone || dto.email) {
      const duplicate = await this.usersRepository.findByPhoneOrEmailExcluding(
        id,
        dto.phone,
        dto.email,
      );
      if (duplicate)
        throw new ConflictException(
          'A user with this phone or email already exists.',
        );
    }

    const updated = await this.usersRepository.update(id, dto);

    if (dto.roleId) {
      await this.permissionsResolver.invalidate(id);
    }

    return updated;
  }

  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
    requestingUserId: string,
  ) {
    if (id === requestingUserId && dto.status === 'inactive') {
      throw new ForbiddenException('You cannot deactivate your own account.');
    }

    await this.findById(id);
    return this.usersRepository.updateStatus(id, dto.status);
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('Provide a phone or email to update.');
    }

    const duplicate = await this.usersRepository.findByPhoneOrEmailExcluding(
      userId,
      dto.phone,
      dto.email,
    );
    if (duplicate)
      throw new ConflictException(
        'A user with this phone or email already exists.',
      );

    return this.usersRepository.update(userId, dto);
  }
}
