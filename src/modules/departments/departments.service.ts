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
import { DepartmentType } from '@prisma/client';

const SINGLETON_TYPES: DepartmentType[] = ['central_warehouse', 'pharmacy'];

@Injectable()
export class DepartmentsService {
  constructor(private readonly departmentsRepository: DepartmentsRepository) {}

  async list(dto: ListDepartmentsDto): Promise<PaginatedResult<unknown>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const { items, total } = await this.departmentsRepository.findMany({
      skip: (page - 1) * limit,
      take: limit,
      type: dto.type,
      isActive:
        dto.isActive === undefined ? undefined : dto.isActive === 'true',
      search: dto.search,
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const department = await this.departmentsRepository.findById(id);
    if (!department) throw new NotFoundException('Department not found.');
    return department;
  }

  async create(dto: CreateDepartmentDto) {
    const existing = await this.departmentsRepository.findByName(dto.name);
    if (existing)
      throw new ConflictException(
        'A department with this name already exists.',
      );

    if (SINGLETON_TYPES.includes(dto.type)) {
      const count = await this.departmentsRepository.countByType(dto.type);
      if (count > 0) {
        throw new ConflictException(
          `A department of type "${dto.type}" already exists; only one is allowed.`,
        );
      }
    }

    if (dto.managerId) {
      await this.assertValidManagerCandidate(dto.managerId);
    }

    const department = await this.departmentsRepository.create({
      name: dto.name,
      type: dto.type,
      managerId: dto.managerId,
    });

    if (dto.managerId) {
      await this.departmentsRepository.setUserDepartment(
        dto.managerId,
        department.id,
      );
    }

    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findById(id);

    if (dto.name) {
      const existing = await this.departmentsRepository.findByName(dto.name);
      if (existing && existing.id !== id) {
        throw new ConflictException(
          'A department with this name already exists.',
        );
      }
    }

    return this.departmentsRepository.update(id, dto);
  }

  async updateStatus(id: string, dto: UpdateDepartmentStatusDto) {
    const department = await this.findById(id);

    if (!dto.isActive && SINGLETON_TYPES.includes(department.type)) {
      throw new BadRequestException(
        `The ${department.type.replace('_', ' ')} cannot be deactivated -- it is required for core operations.`,
      );
    }

    return this.departmentsRepository.updateStatus(id, dto.isActive);
  }

  async assignManager(id: string, dto: AssignManagerDto) {
    await this.findById(id);

    if (!dto.managerId) {
      return this.departmentsRepository.setManager(id, null);
    }

    await this.assertValidManagerCandidate(dto.managerId);

    const updated = await this.departmentsRepository.setManager(
      id,
      dto.managerId,
    );
    await this.departmentsRepository.setUserDepartment(dto.managerId, id);
    return updated;
  }

  private async assertValidManagerCandidate(userId: string) {
    const user = await this.departmentsRepository.findUserById(userId);
    if (!user)
      throw new BadRequestException('Assigned manager does not exist.');
    if (user.status !== 'active')
      throw new BadRequestException('Assigned manager must be an active user.');
  }
}
