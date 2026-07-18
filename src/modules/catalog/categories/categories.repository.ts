import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

@Injectable()
export class CategoriesRepository {
    constructor(private readonly prisma: PrismaService) {}

    findAll() {
        return this.prisma.category.findMany({
            include: { parentCategory: { select: { id: true, name: true } } },
            orderBy: { name: 'asc' },
        });
    }

    findById(id: string) {
        return this.prisma.category.findUnique({
            where: { id },
            include: { parentCategory: { select: { id: true, name: true } } },
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
