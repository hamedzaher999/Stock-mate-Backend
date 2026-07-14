import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductsRepository } from './products.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async list(dto: ListProductsDto): Promise<PaginatedResult<unknown>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const { items, total } = await this.productsRepository.findMany({
      skip: (page - 1) * limit,
      take: limit,
      categoryId: dto.categoryId,
      materialType: dto.materialType,
      isActive:
        dto.isActive === undefined ? undefined : dto.isActive === 'true',
      search: dto.search,
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const product = await this.productsRepository.findById(id);
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  async create(dto: CreateProductDto, createdById: string) {
    if (dto.categoryId) {
      const category = await this.productsRepository.categoryExists(
        dto.categoryId,
      );
      if (!category) throw new BadRequestException('Category does not exist.');
    }

    return this.productsRepository.create({
      name: dto.name,
      categoryId: dto.categoryId,
      materialType: dto.materialType,
      description: dto.description,
      createdById,
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findById(id);

    if (dto.categoryId) {
      const category = await this.productsRepository.categoryExists(
        dto.categoryId,
      );
      if (!category) throw new BadRequestException('Category does not exist.');
    }

    return this.productsRepository.update(id, dto);
  }

  async updateStatus(id: string, dto: UpdateProductStatusDto) {
    await this.findById(id);
    return this.productsRepository.updateStatus(id, dto.isActive);
  }
}
