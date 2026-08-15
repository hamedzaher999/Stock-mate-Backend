import { Injectable } from '@nestjs/common';
import { AdjustmentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { variantMinimalSelect } from '../../../common/selects/variant.select';
import { ReportGroupBy } from '../../../common/enums/report-group-by.enum';
export interface AdjustmentsDepartmentBreakdown {
    departmentId: string;
    departmentName: string;
    count: number;
    quantityIncreased: number;
    quantityDecreased: number;
}
const INCREASING_ADJUSTMENT_TYPES: AdjustmentType[] = ['found'];

const adjustmentRowSelect = {
    id: true,
    variantId: true,
    departmentId: true,
    batchId: true,
    adjustmentType: true,
    quantity: true,
    referenceType: true,
    referenceId: true,
    notes: true,
    createdAt: true,
    variant: { select: variantMinimalSelect },
    batch: { select: { id: true, batchNumber: true } },
    department: { select: { id: true, name: true } },
    reportedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.InventoryAdjustmentSelect;

export interface AdjustmentsReportSummary {
    totalAdjustments: number;
    totalQuantity: number;
    byAdjustmentType: {
        adjustmentType: string;
        count: number;
        totalQuantity: number;
    }[];
}

export interface AdjustmentsSeriesPoint {
    bucket: string;
    quantityIncreased: number;
    quantityDecreased: number;
}

@Injectable()
export class AdjustmentsReportRepository {
    constructor(private readonly prisma: PrismaService) {}

    async getSummary(
        where: Prisma.InventoryAdjustmentWhereInput,
    ): Promise<AdjustmentsReportSummary> {
        const [totalCount, byType, totalAgg] = await Promise.all([
            this.prisma.inventoryAdjustment.count({ where }),
            this.prisma.inventoryAdjustment.groupBy({
                by: ['adjustmentType'],
                where,
                orderBy: { adjustmentType: 'asc' },
                _count: { _all: true },
                _sum: { quantity: true },
            }),
            this.prisma.inventoryAdjustment.aggregate({
                where,
                _sum: { quantity: true },
            }),
        ]);

        return {
            totalAdjustments: totalCount,
            totalQuantity: Number(totalAgg._sum.quantity ?? 0),
            byAdjustmentType: byType.map((t) => ({
                adjustmentType: t.adjustmentType,
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
        adjustmentType?: AdjustmentType;
        bucket: ReportGroupBy;
    }): Promise<AdjustmentsSeriesPoint[]> {
        const conditions: Prisma.Sql[] = [
            Prisma.sql`created_at >= ${params.from}`,
            Prisma.sql`created_at <= ${params.to}`,
        ];
        if (params.departmentId) {
            conditions.push(
                Prisma.sql`department_id = ${params.departmentId}::uuid`,
            );
        }
        if (params.variantId) {
            conditions.push(Prisma.sql`variant_id = ${params.variantId}::uuid`);
        }
        if (params.adjustmentType) {
            conditions.push(
                Prisma.sql`adjustment_type = ${params.adjustmentType}::adjustment_type`,
            );
        }

        const whereClause = Prisma.join(conditions, ' AND ');
        const increasingList = Prisma.join(
            INCREASING_ADJUSTMENT_TYPES.map(
                (t) => Prisma.sql`${t}::adjustment_type`,
            ),
        );

        const rows = await this.prisma.$queryRaw<
            {
                bucket: Date;
                quantityIncreased: number;
                quantityDecreased: number;
            }[]
        >`
            SELECT
                date_trunc(${params.bucket}, created_at) AS "bucket",
                COALESCE(SUM(quantity) FILTER (WHERE adjustment_type IN (${increasingList})), 0)::float AS "quantityIncreased",
                COALESCE(SUM(quantity) FILTER (WHERE adjustment_type NOT IN (${increasingList})), 0)::float AS "quantityDecreased"
            FROM inventory_adjustments
            WHERE ${whereClause}
            GROUP BY 1
            ORDER BY 1
        `;

        return rows.map((r) => ({
            bucket: r.bucket.toISOString().slice(0, 10),
            quantityIncreased: r.quantityIncreased,
            quantityDecreased: r.quantityDecreased,
        }));
    }

    async countRows(where: Prisma.InventoryAdjustmentWhereInput) {
        return this.prisma.inventoryAdjustment.count({ where });
    }

    async findRows(
        where: Prisma.InventoryAdjustmentWhereInput,
        skip: number,
        take: number,
    ) {
        const [items, total] = await Promise.all([
            this.prisma.inventoryAdjustment.findMany({
                where,
                select: adjustmentRowSelect,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.inventoryAdjustment.count({ where }),
        ]);
        return { items, total };
    }

    async findAllRowsForExport(where: Prisma.InventoryAdjustmentWhereInput) {
        return this.prisma.inventoryAdjustment.findMany({
            where,
            select: adjustmentRowSelect,
            orderBy: { createdAt: 'asc' },
        });
    }
    async getDepartmentBreakdown(params: {
        from: Date;
        to: Date;
        departmentId?: string;
        variantId?: string;
        adjustmentType?: AdjustmentType;
    }): Promise<AdjustmentsDepartmentBreakdown[]> {
        const conditions: Prisma.Sql[] = [
            Prisma.sql`ia.created_at >= ${params.from}`,
            Prisma.sql`ia.created_at <= ${params.to}`,
        ];
        if (params.departmentId) {
            conditions.push(
                Prisma.sql`ia.department_id = ${params.departmentId}::uuid`,
            );
        }
        if (params.variantId) {
            conditions.push(
                Prisma.sql`ia.variant_id = ${params.variantId}::uuid`,
            );
        }
        if (params.adjustmentType) {
            conditions.push(
                Prisma.sql`ia.adjustment_type = ${params.adjustmentType}::adjustment_type`,
            );
        }
        const whereClause = Prisma.join(conditions, ' AND ');
        const increasingList = Prisma.join(
            INCREASING_ADJUSTMENT_TYPES.map(
                (t) => Prisma.sql`${t}::adjustment_type`,
            ),
        );

        return this.prisma.$queryRaw<AdjustmentsDepartmentBreakdown[]>`
            SELECT
                ia.department_id AS "departmentId",
                d.name AS "departmentName",
                COUNT(*)::int AS "count",
                COALESCE(SUM(ia.quantity) FILTER (WHERE ia.adjustment_type IN (${increasingList})), 0)::float AS "quantityIncreased",
                COALESCE(SUM(ia.quantity) FILTER (WHERE ia.adjustment_type NOT IN (${increasingList})), 0)::float AS "quantityDecreased"
            FROM inventory_adjustments ia
            JOIN departments d ON d.id = ia.department_id
            WHERE ${whereClause}
            GROUP BY ia.department_id, d.name
            ORDER BY d.name
        `;
    }
}
