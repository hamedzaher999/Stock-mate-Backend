import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { InventoryLedgerService } from '../transactions/inventory-ledger.service';
import { allocateFefo } from '../../../common/utils/fefo.util';

@Injectable()
export class ConsumptionRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly inventoryLedger: InventoryLedgerService,
    ) {}

    findDepartmentType(id: string) {
        return this.prisma.department.findUnique({
            where: { id },
            select: {
                id: true,
                type: true,
                isActive: true,
                tracksInventory: true,
            },
        });
    }

    findVariantMaterialType(id: string) {
        return this.prisma.productVariant.findUnique({
            where: { id },
            select: {
                id: true,
                isActive: true,
                product: { select: { materialType: true, isActive: true } },
            },
        });
    }

    consume(params: {
        departmentId: string;
        performedById: string;
        notes?: string;
        lines: { variantId: string; quantity: number }[];
    }) {
        return this.prisma.$transaction(async (tx) => {
            const results: {
                variantId: string;
                batchId: string;
                quantity: number;
            }[] = [];

            for (const line of params.lines) {
                const batchStocks = await tx.batchStock.findMany({
                    where: {
                        departmentId: params.departmentId,
                        quantity: { gt: 0 },
                        batch: { variantId: line.variantId },
                    },
                    select: {
                        quantity: true,
                        batch: { select: { id: true, expirationDate: true } },
                    },
                });

                const allocations = allocateFefo(
                    batchStocks.map((bs) => ({
                        batchId: bs.batch.id,
                        expirationDate: bs.batch.expirationDate,
                        quantity: Number(bs.quantity),
                    })),
                    line.quantity,
                );

                for (const alloc of allocations) {
                    const updatedStock = await tx.batchStock.update({
                        where: {
                            batchId_departmentId: {
                                batchId: alloc.batchId,
                                departmentId: params.departmentId,
                            },
                        },
                        data: { quantity: { decrement: alloc.quantity } },
                    });

                    await this.inventoryLedger.record(tx, {
                        transactionType: 'department_consumption',
                        variantId: line.variantId,
                        batchId: alloc.batchId,
                        departmentId: params.departmentId,
                        quantity: -alloc.quantity,
                        balanceAfter: Number(updatedStock.quantity),
                        performedById: params.performedById,
                        notes: params.notes,
                    });

                    results.push({
                        variantId: line.variantId,
                        batchId: alloc.batchId,
                        quantity: alloc.quantity,
                    });
                }
            }

            return results;
        });
    }
}
