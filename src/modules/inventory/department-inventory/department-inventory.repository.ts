import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const snapshotSelect = {
    id: true,
    departmentId: true,
    variantId: true,
    currentQuantity: true,
    lastRefillQuantity: true,
    lastRefillDate: true,
    updatedAt: true,
    department: { select: { id: true, name: true, type: true } },
    variant: { select: { id: true, variantName: true, sku: true } },
} satisfies Prisma.DepartmentInventorySelect;

@Injectable()
export class DepartmentInventoryRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findMany(params: {
        skip: number;
        take: number;
        departmentId?: string;
        variantId?: string;
    }) {
        const where: Prisma.DepartmentInventoryWhereInput = {
            departmentId: params.departmentId,
            variantId: params.variantId,
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.departmentInventory.findMany({
                where,
                select: snapshotSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { updatedAt: 'desc' },
            }),
            this.prisma.departmentInventory.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.departmentInventory.findUnique({
            where: { id },
            select: snapshotSelect,
        });
    }

    findRequestingUserContext(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: { departmentId: true, role: { select: { name: true } } },
        });
    }

    findDepartmentType(id: string) {
        return this.prisma.department.findUnique({
            where: { id },
            select: { id: true, type: true },
        });
    }

    async findLiveStock(departmentId: string) {
        const rows = await this.prisma.batchStock.findMany({
            where: { departmentId, quantity: { gt: 0 } },
            select: {
                quantity: true,
                batch: {
                    select: {
                        id: true,
                        batchNumber: true,
                        expirationDate: true,
                        variantId: true,
                        variant: {
                            select: { id: true, variantName: true, sku: true },
                        },
                    },
                },
            },
        });

        const byVariant = new Map<
            string,
            {
                variantId: string;
                variantName: string;
                sku: string;
                totalQuantity: number;
                batches: unknown[];
            }
        >();

        for (const row of rows) {
            const key = row.batch.variantId;
            if (!byVariant.has(key)) {
                byVariant.set(key, {
                    variantId: row.batch.variantId,
                    variantName: row.batch.variant.variantName,
                    sku: row.batch.variant.sku,
                    totalQuantity: 0,
                    batches: [],
                });
            }
            const entry = byVariant.get(key)!;
            entry.totalQuantity += Number(row.quantity);
            entry.batches.push({
                batchId: row.batch.id,
                batchNumber: row.batch.batchNumber,
                expirationDate: row.batch.expirationDate,
                quantity: Number(row.quantity),
            });
        }

        return Array.from(byVariant.values());
    }
}
