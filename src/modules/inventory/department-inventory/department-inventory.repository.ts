import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { variantInventorySelect } from '../../../common/selects/variant.select';

@Injectable()
export class DepartmentInventoryRepository {
    constructor(private readonly prisma: PrismaService) {}

    findRequestingUserContext(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: { departmentId: true, role: { select: { name: true } } },
        });
    }

    findDepartmentType(id: string) {
        return this.prisma.department.findUnique({
            where: { id },
            select: { id: true, type: true, tracksInventory: true },
        });
    }

    async countDistinctVariants(departmentId: string): Promise<number> {
        const rows = await this.prisma.batch.findMany({
            where: {
                batchStocks: { some: { departmentId, quantity: { gt: 0 } } },
            },
            distinct: ['variantId'],
            select: { variantId: true },
        });
        return rows.length;
    }

    async findLiveStockPage(departmentId: string, skip: number, take: number) {
        const variantIdRows = await this.prisma.batch.findMany({
            where: {
                batchStocks: { some: { departmentId, quantity: { gt: 0 } } },
            },
            distinct: ['variantId'],
            select: { variantId: true },
            skip,
            take,
            orderBy: { variantId: 'asc' },
        });
        const variantIds = variantIdRows.map((r) => r.variantId);

        if (variantIds.length === 0) return [];

        const rows = await this.prisma.batchStock.findMany({
            where: {
                departmentId,
                quantity: { gt: 0 },
                batch: { variantId: { in: variantIds } },
            },
            select: {
                quantity: true,
                batch: {
                    select: {
                        id: true,
                        batchNumber: true,
                        expirationDate: true,
                        variantId: true,
                        variant: { select: variantInventorySelect },
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
                unit: unknown;
                product: unknown;
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
                    unit: row.batch.variant.unit,
                    product: row.batch.variant.product,
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

        return variantIds.map((id) => byVariant.get(id)).filter(Boolean);
    }
}
