import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

@Injectable()
export class CategoriesRepository {
    constructor(private readonly prisma: PrismaService) {}

    findSiblingByName(name: string, parentCategoryId: string | null) {
        return this.prisma.category.findFirst({
            where: { name, parentCategoryId },
        });
    }

    create(data: { name: string; parentCategoryId?: string }) {
        return this.prisma.category.create({ data });
    }

    update(id: string, data: { name?: string; parentCategoryId?: string }) {
        return this.prisma.category.update({ where: { id }, data });
    }

    countProductsUsingCategory(id: string) {
        return this.prisma.product.count({ where: { categoryId: id } });
    }

    countSubcategories(id: string) {
        return this.prisma.category.count({ where: { parentCategoryId: id } });
    }

    delete(id: string) {
        return this.prisma.category.delete({ where: { id } });
    }
}
