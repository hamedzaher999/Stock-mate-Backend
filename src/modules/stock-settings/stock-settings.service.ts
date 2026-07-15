import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StockSettingsRepository } from './stock-settings.repository';
import { CreateStockSettingDto } from './dto/create-stock-setting.dto';
import { UpdateStockSettingDto } from './dto/update-stock-setting.dto';
import { UpdateStockSettingStatusDto } from './dto/update-stock-setting-status.dto';
import { ListStockSettingsDto } from './dto/list-stock-settings.dto';
import { PaginatedResult } from '../../core/interfaces/paginated-result.interface';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../common/constants/roles.constants';

@Injectable()
export class StockSettingsService {
  constructor(
    private readonly stockSettingsRepository: StockSettingsRepository,
  ) {}

  async list(dto: ListStockSettingsDto): Promise<PaginatedResult<unknown>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const { items, total } = await this.stockSettingsRepository.findMany({
      skip: (page - 1) * limit,
      take: limit,
      departmentId: dto.departmentId,
      variantId: dto.variantId,
      isActive:
        dto.isActive === undefined ? undefined : dto.isActive === 'true',
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const setting = await this.stockSettingsRepository.findById(id);
    if (!setting) throw new NotFoundException('Stock setting not found.');
    return setting;
  }

  async create(dto: CreateStockSettingDto, requestingUserId: string) {
    this.assertValidRange(dto.minimumStock, dto.maximumStock);
    await this.assertDepartmentScope(requestingUserId, dto.departmentId);

    const variant = await this.stockSettingsRepository.variantExists(
      dto.variantId,
    );
    if (!variant) throw new BadRequestException('Variant does not exist.');

    const department = await this.stockSettingsRepository.departmentExists(
      dto.departmentId,
    );
    if (!department)
      throw new BadRequestException('Department does not exist.');

    const existing =
      await this.stockSettingsRepository.findByVariantAndDepartment(
        dto.variantId,
        dto.departmentId,
      );
    if (existing)
      throw new ConflictException(
        'This variant is already configured for this department.',
      );

    return this.stockSettingsRepository.create({
      variantId: dto.variantId,
      departmentId: dto.departmentId,
      storageLocation: dto.storageLocation,
      minimumStock: dto.minimumStock,
      maximumStock: dto.maximumStock,
      createdById: requestingUserId,
    });
  }

  async update(
    id: string,
    dto: UpdateStockSettingDto,
    requestingUserId: string,
  ) {
    const existing = await this.findById(id);
    await this.assertDepartmentScope(requestingUserId, existing.departmentId);

    const effectiveMin =
      dto.minimumStock ??
      (existing.minimumStock ? Number(existing.minimumStock) : undefined);
    const effectiveMax =
      dto.maximumStock ??
      (existing.maximumStock ? Number(existing.maximumStock) : undefined);
    this.assertValidRange(effectiveMin, effectiveMax);

    return this.stockSettingsRepository.update(id, dto);
  }

  async updateStatus(
    id: string,
    dto: UpdateStockSettingStatusDto,
    requestingUserId: string,
  ) {
    const existing = await this.findById(id);
    await this.assertDepartmentScope(requestingUserId, existing.departmentId);
    return this.stockSettingsRepository.updateStatus(id, dto.isActive);
  }

  async delete(id: string, requestingUserId: string) {
    const existing = await this.findById(id);
    await this.assertDepartmentScope(requestingUserId, existing.departmentId);
    return this.stockSettingsRepository.delete(id);
  }

  private assertValidRange(min?: number, max?: number) {
    if (min !== undefined && max !== undefined && min > max) {
      throw new BadRequestException(
        'minimumStock cannot be greater than maximumStock.',
      );
    }
  }

  private async assertDepartmentScope(
    requestingUserId: string,
    targetDepartmentId: string,
  ) {
    const requestingUser =
      await this.stockSettingsRepository.findRequestingUser(requestingUserId);
    if (!requestingUser)
      throw new BadRequestException('Requesting user not found.');

    if (requestingUser.role.name === HOSPITAL_MANAGER_ROLE_NAME) return;

    if (requestingUser.departmentId !== targetDepartmentId) {
      throw new ForbiddenException(
        'You can only manage stock settings for your own department.',
      );
    }
  }
}
