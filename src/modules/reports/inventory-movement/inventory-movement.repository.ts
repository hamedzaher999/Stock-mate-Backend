import { Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { variantMinimalSelect } from '../../../common/selects/variant.select';
import { ReportGroupBy } from '../../../common/enums/report-group-by.enum';

export interface InventoryMovementDepartmentBreakdown {
    departmentId: string;
    departmentName: string;
    count: number;
    quantityIn: number;
    quantityOut: number;
}
const movementRowSelect = {
    id: true,
    transactionType: true,
    variantId: true,
    batchId: true,
    departmentId: true,
    quantity: true,
    balanceAfter: true,
    referenceType: true,
    referenceId: true,
    performedById: true,
    transactionDate: true,
    notes: true,
    variant: { select: variantMinimalSelect },
    batch: { select: { id: true, batchNumber: true } },
    department: { select: { id: true, name: true } },
    performedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.InventoryTransactionSelect;

export interface InventoryMovementSummary {
    totalTransactions: number;
    totalQuantityIn: number;
    totalQuantityOut: number;
    netQuantity: number;
    byTransactionType: {
        transactionType: string;
        count: number;
        totalQuantity: number;
    }[];
}

export interface InventoryMovementSeriesPoint {
    bucket: string;
    quantityIn: number;
    quantityOut: number;
}

@Injectable()
export class InventoryMovementRepository {
    constructor(private readonly prisma: PrismaService) {}

    async getSummary(
        where: Prisma.InventoryTransactionWhereInput,
    ): Promise<InventoryMovementSummary> {
        const [totalCount, byType, inAgg, outAgg] = await Promise.all([
            this.prisma.inventoryTransaction.count({ where }),
            this.prisma.inventoryTransaction.groupBy({
                by: ['transactionType'],
                where,
                orderBy: { transactionType: 'asc' },
                _count: { _all: true },
                _sum: { quantity: true },
            }),
            this.prisma.inventoryTransaction.aggregate({
                where: { ...where, quantity: { gt: 0 } },
                _sum: { quantity: true },
            }),
            this.prisma.inventoryTransaction.aggregate({
                where: { ...where, quantity: { lt: 0 } },
                _sum: { quantity: true },
            }),
        ]);

        const totalQuantityIn = Number(inAgg._sum.quantity ?? 0);
        const totalQuantityOut = Math.abs(Number(outAgg._sum.quantity ?? 0));

        return {
            totalTransactions: totalCount,
            totalQuantityIn,
            totalQuantityOut,
            netQuantity: totalQuantityIn - totalQuantityOut,
            byTransactionType: byType.map((t) => ({
                transactionType: t.transactionType,
                count: t._count._all,
                totalQuantity: Number(t._sum?.quantity ?? 0),
            })),
        };
    }

    async getSeries(params: {
        from: Date;
        to: Date;
        departmentId?: string;
        variantId?: string;
        transactionType?: TransactionType;
        bucket: ReportGroupBy;
    }): Promise<InventoryMovementSeriesPoint[]> {
        const conditions: Prisma.Sql[] = [
            Prisma.sql`transaction_date >= ${params.from}`,
            Prisma.sql`transaction_date <= ${params.to}`,
        ];
        if (params.departmentId) {
            conditions.push(
                Prisma.sql`department_id = ${params.departmentId}::uuid`,
            );
        }
        if (params.variantId) {
            conditions.push(Prisma.sql`variant_id = ${params.variantId}::uuid`);
        }
        if (params.transactionType) {
            conditions.push(
                Prisma.sql`transaction_type = ${params.transactionType}::transaction_type`,
            );
        }

        const whereClause = Prisma.join(conditions, ' AND ');

        const rows = await this.prisma.$queryRaw<
            { bucket: Date; quantityIn: number; quantityOut: number }[]
        >`
            SELECT
                date_trunc(${params.bucket}, transaction_date) AS "bucket",
                COALESCE(SUM(quantity) FILTER (WHERE quantity > 0), 0)::float AS "quantityIn",
                COALESCE(SUM(quantity) FILTER (WHERE quantity < 0), 0)::float AS "quantityOut"
            FROM inventory_transactions
            WHERE ${whereClause}
            GROUP BY 1
            ORDER BY 1
        `;

        return rows.map((r) => ({
            bucket: r.bucket.toISOString().slice(0, 10),
            quantityIn: r.quantityIn,
            quantityOut: Math.abs(r.quantityOut),
        }));
    }

    async countRows(where: Prisma.InventoryTransactionWhereInput) {
        return this.prisma.inventoryTransaction.count({ where });
    }

    async findRows(
        where: Prisma.InventoryTransactionWhereInput,
        skip: number,
        take: number,
    ) {
        const [items, total] = await this.prisma.$transaction([
            this.prisma.inventoryTransaction.findMany({
                where,
                select: movementRowSelect,
                skip,
                take,
                orderBy: { transactionDate: 'desc' },
            }),
            this.prisma.inventoryTransaction.count({ where }),
        ]);
        return { items, total };
    }

    async findAllRowsForExport(where: Prisma.InventoryTransactionWhereInput) {
        return this.prisma.inventoryTransaction.findMany({
            where,
            select: movementRowSelect,
            orderBy: { transactionDate: 'asc' },
        });
    }
    async getDepartmentBreakdown(params: {
        from: Date;
        to: Date;
        departmentId?: string;
        variantId?: string;
        transactionType?: TransactionType;
    }): Promise<InventoryMovementDepartmentBreakdown[]> {
        const conditions: Prisma.Sql[] = [
            Prisma.sql`it.transaction_date >= ${params.from}`,
            Prisma.sql`it.transaction_date <= ${params.to}`,
        ];
        if (params.departmentId) {
            conditions.push(
                Prisma.sql`it.department_id = ${params.departmentId}::uuid`,
            );
        }
        if (params.variantId) {
            conditions.push(
                Prisma.sql`it.variant_id = ${params.variantId}::uuid`,
            );
        }
        if (params.transactionType) {
            conditions.push(
                Prisma.sql`it.transaction_type = ${params.transactionType}::transaction_type`,
            );
        }
        const whereClause = Prisma.join(conditions, ' AND ');

        const rows = await this.prisma.$queryRaw<
            {
                departmentId: string;
                departmentName: string;
                count: number;
                quantityIn: number;
                quantityOut: number;
            }[]
        >`
            SELECT
                it.department_id AS "departmentId",
                d.name AS "departmentName",
                COUNT(*)::int AS "count",
                COALESCE(SUM(it.quantity) FILTER (WHERE it.quantity > 0), 0)::float AS "quantityIn",
                COALESCE(SUM(it.quantity) FILTER (WHERE it.quantity < 0), 0)::float AS "quantityOut"
            FROM inventory_transactions it
            JOIN departments d ON d.id = it.department_id
            WHERE ${whereClause}
            GROUP BY it.department_id, d.name
            ORDER BY d.name
        `;

        return rows.map((r) => ({
            ...r,
            quantityOut: Math.abs(r.quantityOut),
        }));
    }
}
