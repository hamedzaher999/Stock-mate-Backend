import {
    BadRequestException,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
    AdjustmentsReportRepository,
    AdjustmentsReportSummary,
} from './adjustments-report.repository';
import { ListAdjustmentsReportDto } from './dto/list-adjustments-report.dto';
import { ReportAccessService } from '../common/report-access.service';
import { ExcelExportService } from '../common/excel-export.service';
import {
    resolveReportDateRange,
    pickDefaultGroupBy,
} from '../common/report-date-range.util';
import { ReportGroupBy } from '../../../common/enums/report-group-by.enum';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import {
    ADJUSTMENT_TYPE_LABELS_AR,
    REFERENCE_TYPE_LABELS_AR,
    translateEnum,
} from '../common/report-labels';

const MAX_EXPORT_ROWS = 50_000;

interface BuiltFilters {
    where: Prisma.InventoryAdjustmentWhereInput;
    from: Date;
    to: Date;
    departmentId?: string;
    variantId?: string;
    groupBy: ReportGroupBy;
}

@Injectable()
export class AdjustmentsReportService {
    constructor(
        private readonly repository: AdjustmentsReportRepository,
        private readonly reportAccessService: ReportAccessService,
        private readonly excelExportService: ExcelExportService,
    ) {}

    async getReport(dto: ListAdjustmentsReportDto, requestingUserId: string) {
        const filters = await this.buildFilters(dto, requestingUserId);
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const [summary, byDepartment, series, rowsPage] = await Promise.all([
            this.repository.getSummary(filters.where),
            this.repository.getDepartmentBreakdown({
                from: filters.from,
                to: filters.to,
                departmentId: filters.departmentId,
                variantId: filters.variantId,
                adjustmentType: dto.adjustmentType,
            }),
            this.repository.getSeries({
                from: filters.from,
                to: filters.to,
                departmentId: filters.departmentId,
                variantId: filters.variantId,
                adjustmentType: dto.adjustmentType,
                bucket: filters.groupBy,
            }),
            this.repository.findRows(filters.where, (page - 1) * limit, limit),
        ]);

        const rows: PaginatedResult<unknown> = {
            items: rowsPage.items,
            total: rowsPage.total,
            page,
            limit,
            totalPages: Math.ceil(rowsPage.total / limit),
        };

        return {
            summary,
            byDepartment,
            series,
            rows,
            groupBy: filters.groupBy,
        };
    }
    async exportExcel(
        dto: ListAdjustmentsReportDto,
        requestingUserId: string,
    ): Promise<Buffer> {
        const filters = await this.buildFilters(dto, requestingUserId);

        const rowCount = await this.repository.countRows(filters.where);
        if (rowCount > MAX_EXPORT_ROWS) {
            throw new BadRequestException(
                `This export would contain ${rowCount} rows, which exceeds the ${MAX_EXPORT_ROWS} limit -- narrow the date range or add a department/variant filter.`,
            );
        }

        const [summary, byDepartment, rows] = await Promise.all([
            this.repository.getSummary(filters.where),
            this.repository.getDepartmentBreakdown({
                from: filters.from,
                to: filters.to,
                departmentId: filters.departmentId,
                variantId: filters.variantId,
                adjustmentType: dto.adjustmentType,
            }),
            this.repository.findAllRowsForExport(filters.where),
        ]);

        return this.excelExportService.buildWorkbook([
            {
                name: 'الملخص',
                rightToLeft: true,
                columns: [
                    { header: 'المؤشر', key: 'metric', width: 32 },
                    { header: 'القيمة', key: 'value', width: 20 },
                ],
                rows: this.summaryToRows(summary, filters.from, filters.to),
            },
            {
                name: 'حسب القسم',
                rightToLeft: true,
                columns: [
                    { header: 'القسم', key: 'department', width: 24 },
                    { header: 'عدد التسويات', key: 'count', width: 14 },
                    {
                        header: 'الكمية المضافة',
                        key: 'quantityIncreased',
                        width: 18,
                        numFmt: '#,##0.00',
                    },
                    {
                        header: 'الكمية المخصومة',
                        key: 'quantityDecreased',
                        width: 18,
                        numFmt: '#,##0.00',
                    },
                ],
                rows: byDepartment.map((d) => ({
                    department: d.departmentName,
                    count: d.count,
                    quantityIncreased: d.quantityIncreased,
                    quantityDecreased: d.quantityDecreased,
                })),
            },
            {
                name: 'التسويات',
                rightToLeft: true,
                columns: [
                    { header: 'التاريخ', key: 'date', width: 20 },
                    { header: 'نوع التسوية', key: 'type', width: 18 },
                    { header: 'القسم', key: 'department', width: 22 },
                    { header: 'الصنف', key: 'variant', width: 28 },
                    { header: 'رمز الصنف', key: 'sku', width: 16 },
                    { header: 'الدفعة', key: 'batch', width: 16 },
                    {
                        header: 'الكمية',
                        key: 'quantity',
                        width: 14,
                        numFmt: '#,##0.00',
                    },
                    { header: 'أُبلغ بواسطة', key: 'reportedBy', width: 22 },
                    { header: 'المرجع', key: 'reference', width: 30 },
                    { header: 'ملاحظات', key: 'notes', width: 32 },
                ],
                rows: rows.map((r) => ({
                    date: r.createdAt,
                    type: translateEnum(
                        ADJUSTMENT_TYPE_LABELS_AR,
                        r.adjustmentType,
                    ),
                    department: r.department.name,
                    variant: r.variant.variantName,
                    sku: r.variant.sku,
                    batch: r.batch?.batchNumber ?? '',
                    quantity: Number(r.quantity),
                    reportedBy: r.reportedBy.fullName,
                    reference: r.referenceType
                        ? `${translateEnum(REFERENCE_TYPE_LABELS_AR, r.referenceType)}: ${r.referenceId ?? ''}`
                        : '',
                    notes: r.notes ?? '',
                })),
            },
        ]);
    }

    private summaryToRows(
        summary: AdjustmentsReportSummary,
        from: Date,
        to: Date,
    ) {
        const rows: { metric: string; value: string | number }[] = [
            { metric: 'من تاريخ', value: from.toISOString().slice(0, 10) },
            { metric: 'إلى تاريخ', value: to.toISOString().slice(0, 10) },
            { metric: 'إجمالي عدد التسويات', value: summary.totalAdjustments },
            { metric: 'إجمالي الكمية', value: summary.totalQuantity },
        ];
        for (const t of summary.byAdjustmentType) {
            const label = translateEnum(
                ADJUSTMENT_TYPE_LABELS_AR,
                t.adjustmentType,
            );
            rows.push({ metric: `${label} - العدد`, value: t.count });
            rows.push({ metric: `${label} - الكمية`, value: t.totalQuantity });
        }
        return rows;
    }
    private async buildFilters(
        dto: ListAdjustmentsReportDto,
        requestingUserId: string,
    ): Promise<BuiltFilters> {
        const { from, to } = resolveReportDateRange(dto.from, dto.to);

        const scope =
            await this.reportAccessService.resolveDepartmentScope(
                requestingUserId,
            );
        if (scope && dto.departmentId && dto.departmentId !== scope) {
            throw new ForbiddenException(
                'You can only view reports for your own department.',
            );
        }
        const departmentId = scope ?? dto.departmentId;

        const where: Prisma.InventoryAdjustmentWhereInput = {
            createdAt: { gte: from, lte: to },
            departmentId,
            variantId: dto.variantId,
            adjustmentType: dto.adjustmentType,
        };

        const groupBy = pickDefaultGroupBy(from, to, dto.groupBy);

        return {
            where,
            from,
            to,
            departmentId,
            variantId: dto.variantId,
            groupBy,
        };
    }
}
