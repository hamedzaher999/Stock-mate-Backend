import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { InventoryLedgerService } from '../transactions/inventory-ledger.service';
import {
    allocateFefo,
    InsufficientStockError,
} from '../../../common/utils/fefo.util';

interface FefoCandidateRow {
    batchId: string;
    variantId: string;
    quantity: number;
    expirationDate: Date | null;
}

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
            const variantIds = [
                ...new Set(params.lines.map((l) => l.variantId)),
            ];

            const candidates = await tx.$queryRaw<FefoCandidateRow[]>`
                SELECT
                    b.id AS "batchId",
                    b.variant_id AS "variantId",
                    bs.quantity::float AS "quantity",
                    b.expiration_date AS "expirationDate"
                FROM batch_stock bs
                JOIN batches b ON b.id = bs.batch_id
                WHERE bs.department_id = ${params.departmentId}::uuid
                  AND b.variant_id = ANY(${variantIds}::uuid[])
                  AND bs.quantity > 0
                FOR UPDATE OF bs
            `;

            const byVariant = new Map<string, FefoCandidateRow[]>();
            for (const row of candidates) {
                const list = byVariant.get(row.variantId) ?? [];
                list.push(row);
                byVariant.set(row.variantId, list);
            }

            const results: {
                variantId: string;
                batchId: string;
                quantity: number;
            }[] = [];

            for (const line of params.lines) {
                const rows = byVariant.get(line.variantId) ?? [];
                const allocations = allocateFefo(
                    rows.map((r) => ({
                        batchId: r.batchId,
                        expirationDate: r.expirationDate,
                        quantity: r.quantity,
                    })),
                    line.quantity,
                );

                for (const alloc of allocations) {
                    const updated = await tx.$queryRaw<{ quantity: number }[]>`
                        UPDATE batch_stock
                        SET quantity = quantity - ${alloc.quantity}
                        WHERE batch_id = ${alloc.batchId}::uuid
                          AND department_id = ${params.departmentId}::uuid
                          AND quantity >= ${alloc.quantity}
                        RETURNING quantity::float AS "quantity"
                    `;
                    if (updated.length === 0) {
                        throw new InsufficientStockError(alloc.quantity);
                    }

                    await this.inventoryLedger.record(tx, {
                        transactionType: 'department_consumption',
                        variantId: line.variantId,
                        batchId: alloc.batchId,
                        departmentId: params.departmentId,
                        quantity: -alloc.quantity,
                        balanceAfter: updated[0].quantity,
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
