import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesRepository } from './categories.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  findAll() {
    return this.categoriesRepository.findAll();
  }

  async findById(id: string) {
    const category = await this.categoriesRepository.findById(id);
    if (!category) throw new NotFoundException('Category not found.');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    if (dto.parentCategoryId) {
      await this.findById(dto.parentCategoryId);
    }
    return this.categoriesRepository.create(dto);
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findById(id);

    if (dto.parentCategoryId) {
      if (dto.parentCategoryId === id) {
        throw new BadRequestException('A category cannot be its own parent.');
      }
      await this.findById(dto.parentCategoryId);
    }

    return this.categoriesRepository.update(id, dto);
  }

  async delete(id: string) {
    await this.findById(id);

    const [productsCount, subcategoriesCount] = await Promise.all([
      this.categoriesRepository.countProductsUsingCategory(id),
      this.categoriesRepository.countSubcategories(id),
    ]);

    if (productsCount > 0)
      throw new BadRequestException(
        'Cannot delete a category that has products assigned.',
      );
    if (subcategoriesCount > 0)
      throw new BadRequestException(
        'Cannot delete a category that has subcategories.',
      );

    return this.categoriesRepository.delete(id);
  }
}
