import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

interface LiveStockRow {
    variantId: string;
    totalCount: number;
    variantName: string;
    sku: string;
    unitId: string;
    unitName: string;
    unitAbbreviation: string | null;
    productId: string;
    productName: string;
    materialType: string;
    categoryId: string | null;
    categoryName: string | null;
    totalQuantity: number;
    batches: {
        batchId: string;
        batchNumber: string;
        expirationDate: string | null;
        quantity: number;
    }[];
}

@Injectable()
export class DepartmentInventoryRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findLiveStockPage(
        departmentId: string,
        skip: number,
        take: number,
    ): Promise<{ items: unknown[]; total: number }> {
        const rows = await this.prisma.$queryRaw<LiveStockRow[]>`
            WITH paged_variants AS (
                SELECT
                    b.variant_id AS variant_id,
                    COUNT(*) OVER() AS total_count
                FROM batch_stock bs
                JOIN batches b ON b.id = bs.batch_id
                WHERE bs.department_id = ${departmentId}::uuid
                  AND bs.quantity > 0
                GROUP BY b.variant_id
                ORDER BY b.variant_id
                LIMIT ${take} OFFSET ${skip}
            )
            SELECT
                pvd.variant_id                 AS "variantId",
                pvd.total_count::int            AS "totalCount",
                pv.variant_name                 AS "variantName",
                pv.sku                          AS "sku",
                u.id                             AS "unitId",
                u.name                           AS "unitName",
                u.abbreviation                   AS "unitAbbreviation",
                p.id                             AS "productId",
                p.name                           AS "productName",
                p.material_type                  AS "materialType",
                c.id                             AS "categoryId",
                c.name                           AS "categoryName",
                SUM(bs.quantity)::float          AS "totalQuantity",
                json_agg(
                    json_build_object(
                        'batchId', b.id,
                        'batchNumber', b.batch_number,
                        'expirationDate', b.expiration_date,
                        'quantity', bs.quantity::float
                    ) ORDER BY b.expiration_date
                )                                AS "batches"
            FROM paged_variants pvd
            JOIN batch_stock bs
                ON bs.department_id = ${departmentId}::uuid
               AND bs.quantity > 0
            JOIN batches b
                ON b.id = bs.batch_id
               AND b.variant_id = pvd.variant_id
            JOIN product_variants pv ON pv.id = pvd.variant_id
            JOIN units u ON u.id = pv.unit_id
            JOIN products p ON p.id = pv.product_id
            LEFT JOIN categories c ON c.id = p.category_id
            GROUP BY
                pvd.variant_id, pvd.total_count, pv.variant_name, pv.sku,
                u.id, u.name, u.abbreviation,
                p.id, p.name, p.material_type,
                c.id, c.name
            ORDER BY pvd.variant_id;
        `;

        if (rows.length === 0) return { items: [], total: 0 };

        const total = rows[0].totalCount;
        const items = rows.map((r) => ({
            variantId: r.variantId,
            variantName: r.variantName,
            sku: r.sku,
            unit: {
                id: r.unitId,
                name: r.unitName,
                abbreviation: r.unitAbbreviation,
            },
            product: {
                id: r.productId,
                name: r.productName,
                materialType: r.materialType,
                category: r.categoryId
                    ? { id: r.categoryId, name: r.categoryName }
                    : null,
            },
            totalQuantity: r.totalQuantity,
            batches: r.batches,
        }));

        return { items, total };
    }
}
