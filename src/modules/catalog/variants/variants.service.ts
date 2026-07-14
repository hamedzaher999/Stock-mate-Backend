import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VariantsRepository } from './variants.repository';
import { CacheService } from '../../../core/cache/cache.service';
import { CacheKeys } from '../../../core/cache/cache-keys.constants';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { UpdateVariantStatusDto } from './dto/update-variant-status.dto';
import { ListVariantsDto } from './dto/list-variants.dto';
import { SetVariantSuppliersDto } from './dto/set-variant-suppliers.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';

const VARIANT_CACHE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class VariantsService {
  constructor(
    private readonly variantsRepository: VariantsRepository,
    private readonly cacheService: CacheService,
  ) {}

  async list(dto: ListVariantsDto): Promise<PaginatedResult<unknown>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const { items, total } = await this.variantsRepository.findMany({
      skip: (page - 1) * limit,
      take: limit,
      productId: dto.productId,
      isActive:
        dto.isActive === undefined ? undefined : dto.isActive === 'true',
      search: dto.search,
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const cacheKey = CacheKeys.variantDetail(id);
    const cached =
      await this.cacheService.get<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const variant = await this.variantsRepository.findById(id);
    if (!variant) throw new NotFoundException('Variant not found.');

    await this.cacheService.set(cacheKey, variant, VARIANT_CACHE_TTL_MS);
    return variant;
  }

  async create(dto: CreateVariantDto, createdById: string) {
    const product = await this.variantsRepository.productExists(dto.productId);
    if (!product) throw new BadRequestException('Product does not exist.');

    const unit = await this.variantsRepository.unitExists(dto.unitId);
    if (!unit) throw new BadRequestException('Unit does not exist.');

    const existingSku = await this.variantsRepository.findBySku(dto.sku);
    if (existingSku)
      throw new ConflictException('A variant with this SKU already exists.');

    return this.variantsRepository.create({
      productId: dto.productId,
      variantName: dto.variantName,
      sku: dto.sku,
      unitId: dto.unitId,
      createdById,
    });
  }

  async update(id: string, dto: UpdateVariantDto) {
    await this.assertExists(id);

    if (dto.unitId) {
      const unit = await this.variantsRepository.unitExists(dto.unitId);
      if (!unit) throw new BadRequestException('Unit does not exist.');
    }

    const updated = await this.variantsRepository.update(id, dto);
    await this.cacheService.del(CacheKeys.variantDetail(id));
    return updated;
  }

  async updateStatus(id: string, dto: UpdateVariantStatusDto) {
    await this.assertExists(id);
    const updated = await this.variantsRepository.updateStatus(
      id,
      dto.isActive,
    );
    await this.cacheService.del(CacheKeys.variantDetail(id));
    return updated;
  }

  async setSuppliers(id: string, dto: SetVariantSuppliersDto) {
    await this.assertExists(id);

    if (dto.suppliers.length > 0) {
      const foundSuppliers = await this.variantsRepository.suppliersExist(
        dto.suppliers.map((s) => s.supplierId),
      );
      if (foundSuppliers.length !== dto.suppliers.length) {
        throw new BadRequestException('One or more suppliers do not exist.');
      }

      const preferredCount = dto.suppliers.filter((s) => s.isPreferred).length;
      if (preferredCount > 1) {
        throw new BadRequestException(
          'Only one supplier can be marked as preferred per variant.',
        );
      }
    }

    await this.variantsRepository.setSuppliers(id, dto.suppliers);
    await this.cacheService.del(CacheKeys.variantDetail(id));
    return this.findById(id);
  }

  private async assertExists(id: string) {
    const variant = await this.variantsRepository.findById(id);
    if (!variant) throw new NotFoundException('Variant not found.');
    return variant;
  }
}
