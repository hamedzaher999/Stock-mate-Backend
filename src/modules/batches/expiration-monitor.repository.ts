import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

export interface ExpiringBatchStockRow {
    batchId: string;
    batchNumber: string;
    expirationDate: Date;
    variantId: string;
    variantName: string;
    sku: string;
    departmentId: string;
    departmentName: string;
    departmentManagerId: string | null;
    quantity: number;
}

@Injectable()
export class ExpirationMonitorRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findExpiringBatchStocks(
        cutoff: Date,
    ): Promise<ExpiringBatchStockRow[]> {
        const rows = await this.prisma.batchStock.findMany({
            where: {
                quantity: { gt: 0 },
                batch: { expirationDate: { lte: cutoff } },
                department: { isActive: true, tracksInventory: true },
            },
            select: {
                quantity: true,
                department: {
                    select: { id: true, name: true, managerId: true },
                },
                batch: {
                    select: {
                        id: true,
                        batchNumber: true,
                        expirationDate: true,
                        variant: {
                            select: { id: true, variantName: true, sku: true },
                        },
                    },
                },
            },
        });

        return rows.map((row) => ({
            batchId: row.batch.id,
            batchNumber: row.batch.batchNumber,
            expirationDate: row.batch.expirationDate as Date,
            variantId: row.batch.variant.id,
            variantName: row.batch.variant.variantName,
            sku: row.batch.variant.sku,
            departmentId: row.department.id,
            departmentName: row.department.name,
            departmentManagerId: row.department.managerId,
            quantity: Number(row.quantity),
        }));
    }
}
