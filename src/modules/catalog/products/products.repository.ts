import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { Prisma, MaterialType } from '@prisma/client';

const productSelect = {
    id: true,
    name: true,
    categoryId: true,
    materialType: true,
    description: true,
    isActive: true,
    category: { select: { id: true, name: true } },
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.ProductSelect;

@Injectable()
export class ProductsRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findMany(params: {
        skip: number;
        take: number;
        categoryId?: string;
        materialType?: MaterialType;
        isActive?: boolean;
        search?: string;
    }) {
        const where: Prisma.ProductWhereInput = {
            categoryId: params.categoryId,
            materialType: params.materialType,
            isActive: params.isActive,
            ...(params.search && {
                name: { contains: params.search, mode: 'insensitive' },
            }),
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.product.findMany({
                where,
                select: productSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.product.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.product.findUnique({
            where: { id },
            select: productSelect,
        });
    }

    categoryExists(id: string) {
        return this.prisma.category.findUnique({
            where: { id },
            select: { id: true },
        });
    }

    create(data: {
        name: string;
        categoryId?: string;
        materialType: MaterialType;
        description?: string;
        createdById: string;
    }) {
        return this.prisma.product.create({ data, select: productSelect });
    }

    update(
        id: string,
        data: { name?: string; categoryId?: string; description?: string },
    ) {
        return this.prisma.product.update({
            where: { id },
            data,
            select: productSelect,
        });
    }

    updateStatus(id: string, isActive: boolean) {
        return this.prisma.product.update({
            where: { id },
            data: { isActive },
            select: productSelect,
        });
    }
}
