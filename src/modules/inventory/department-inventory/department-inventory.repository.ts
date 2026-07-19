import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

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
