import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { CategoriesRepository } from './categories.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CatalogCacheService } from '../catalog-cache.service';
@Injectable()
export class CategoriesService {
    constructor(
        private readonly categoriesRepository: CategoriesRepository,
        private readonly catalogCacheService: CatalogCacheService,
    ) {}
    findAll() {
        return this.catalogCacheService.getCategories();
    }

    async findById(id: string) {
        const categories = await this.catalogCacheService.getCategories();
        const category = categories.find((c) => c.id === id);
        if (!category) throw new NotFoundException('الفئة غير موجودة.');
        return category;
    }

    async create(dto: CreateCategoryDto) {
        if (dto.parentCategoryId) {
            const parent = await this.findById(dto.parentCategoryId);
            if (parent.name === dto.name) {
                throw new BadRequestException(
                    'A category cannot have the same name as its parent.',
                );
            }
        }

        const sibling = await this.categoriesRepository.findSiblingByName(
            dto.name,
            dto.parentCategoryId ?? null,
        );
        if (sibling) {
            throw new ConflictException(
                'توجد فئة بنفس الاسم في هذا المستوى بالفعل.',
            );
        }

        const created = await this.categoriesRepository.create(dto);
        await this.catalogCacheService.invalidateCategories();
        return created;
    }

    async update(id: string, dto: UpdateCategoryDto) {
        await this.findById(id);

        if (dto.parentCategoryId) {
            if (dto.parentCategoryId === id) {
                throw new BadRequestException(
                    'A category cannot be its own parent.',
                );
            }

            await this.assertNoCycle(id, dto.parentCategoryId);

            const parent = await this.findById(dto.parentCategoryId);
            if (dto.name && parent.name === dto.name) {
                throw new BadRequestException(
                    'A category cannot have the same name as its parent.',
                );
            }
        }

        if (dto.name) {
            const sibling = await this.categoriesRepository.findSiblingByName(
                dto.name,
                dto.parentCategoryId ?? null,
            );
            if (sibling && sibling.id !== id) {
                throw new ConflictException(
                    'A category with this name already exists at this level.',
                );
            }
        }

        const updated = await this.categoriesRepository.update(id, dto);
        await this.catalogCacheService.invalidateCategories();
        return updated;
    }

    async delete(id: string) {
        await this.findById(id);

        const [productsCount, subcategoriesCount] = await Promise.all([
            this.categoriesRepository.countProductsUsingCategory(id),
            this.categoriesRepository.countSubcategories(id),
        ]);

        if (productsCount > 0)
            throw new BadRequestException('لا يمكن حذف فئة تحتوي على منتجات.');
        if (subcategoriesCount > 0)
            throw new BadRequestException(
                'لا يمكن حذف فئة تحتوي على فئات فرعية.',
            );

        await this.categoriesRepository.delete(id);
        await this.catalogCacheService.invalidateCategories();
    }

    private async assertNoCycle(categoryId: string, proposedParentId: string) {
        const categories = await this.catalogCacheService.getCategories();
        const byId = new Map(categories.map((c) => [c.id, c]));

        let current = byId.get(proposedParentId);
        const visited = new Set<string>();

        while (current?.parentCategoryId) {
            if (current.parentCategoryId === categoryId) {
                throw new BadRequestException(
                    'This change would create a circular category hierarchy.',
                );
            }
            if (visited.has(current.id)) break; // safety net against pre-existing bad data
            visited.add(current.id);
            current = byId.get(current.parentCategoryId);
        }
    }
}
