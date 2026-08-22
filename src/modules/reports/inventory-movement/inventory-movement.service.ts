import {
    BadRequestException,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
    InventoryMovementRepository,
    InventoryMovementSummary,
} from './inventory-movement.repository';
import { ListInventoryMovementDto } from './dto/list-inventory-movement.dto';
import { ReportAccessService } from '../common/report-access.service';
import { ExcelExportService } from '../common/excel-export.service';
import {
    resolveReportDateRange,
    pickDefaultGroupBy,
} from '../common/report-date-range.util';
import { ReportGroupBy } from '../../../common/enums/report-group-by.enum';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import {
    REFERENCE_TYPE_LABELS_AR,
    TRANSACTION_TYPE_LABELS_AR,
    translateEnum,
} from '../common/report-labels';
import { ReportsCacheService } from '../common/reports-cache.service';

const MAX_EXPORT_ROWS = 50_000;

interface BuiltFilters {
    where: Prisma.InventoryTransactionWhereInput;
    from: Date;
    to: Date;
    departmentId?: string;
    variantId?: string;
    groupBy: ReportGroupBy;
}

@Injectable()
export class InventoryMovementReportService {
    constructor(
        private readonly repository: InventoryMovementRepository,
        private readonly reportAccessService: ReportAccessService,
        private readonly excelExportService: ExcelExportService,
        private readonly reportsCacheService: ReportsCacheService,
    ) {}

    async getReport(dto: ListInventoryMovementDto, requestingUserId: string) {
        return this.reportsCacheService.getOrCompute(
            'inventory-movement',
            'report',
            requestingUserId,
            { ...dto },
            () => this.computeReport(dto, requestingUserId),
        );
    }

    private async computeReport(
        dto: ListInventoryMovementDto,
        requestingUserId: string,
    ) {
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
                transactionType: dto.transactionType,
            }),
            this.repository.getSeries({
                from: filters.from,
                to: filters.to,
                departmentId: filters.departmentId,
                variantId: filters.variantId,
                transactionType: dto.transactionType,
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
        dto: ListInventoryMovementDto,
        requestingUserId: string,
    ): Promise<Buffer> {
        return this.reportsCacheService.getOrCompute(
            'inventory-movement',
            'export',
            requestingUserId,
            { ...dto },
            () => this.computeExportExcel(dto, requestingUserId),
        );
    }

    private async computeExportExcel(
        dto: ListInventoryMovementDto,
        requestingUserId: string,
    ): Promise<Buffer> {
        const filters = await this.buildFilters(dto, requestingUserId);

        const rowCount = await this.repository.countRows(filters.where);
        if (rowCount > MAX_EXPORT_ROWS) {
            throw new BadRequestException(
                `سوف يحتوي هذا التصدير على ${rowCount} صفاً، وهو ما يتجاوز الحد المسموح به (${MAX_EXPORT_ROWS}) -- يرجى تضييق نطاق التاريخ أو إضافة فلتر للقسم أو الصنف.`,
            );
        }

        const [summary, byDepartment, rows] = await Promise.all([
            this.repository.getSummary(filters.where),
            this.repository.getDepartmentBreakdown({
                from: filters.from,
                to: filters.to,
                departmentId: filters.departmentId,
                variantId: filters.variantId,
                transactionType: dto.transactionType,
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
                    { header: 'عدد الحركات', key: 'count', width: 14 },
                    {
                        header: 'الكمية الواردة',
                        key: 'quantityIn',
                        width: 16,
                        numFmt: '#,##0.00',
                    },
                    {
                        header: 'الكمية الصادرة',
                        key: 'quantityOut',
                        width: 16,
                        numFmt: '#,##0.00',
                    },
                ],
                rows: byDepartment.map((d) => ({
                    department: d.departmentName,
                    count: d.count,
                    quantityIn: d.quantityIn,
                    quantityOut: d.quantityOut,
                })),
            },
            {
                name: 'الحركات',
                rightToLeft: true,
                columns: [
                    { header: 'التاريخ', key: 'date', width: 20 },
                    { header: 'نوع الحركة', key: 'type', width: 26 },
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
                    {
                        header: 'الرصيد بعد الحركة',
                        key: 'balanceAfter',
                        width: 18,
                        numFmt: '#,##0.00',
                    },
                    { header: 'تم بواسطة', key: 'performedBy', width: 22 },
                    { header: 'المرجع', key: 'reference', width: 30 },
                    { header: 'ملاحظات', key: 'notes', width: 32 },
                ],
                rows: rows.map((r) => ({
                    date: r.transactionDate,
                    type: translateEnum(
                        TRANSACTION_TYPE_LABELS_AR,
                        r.transactionType,
                    ),
                    department: r.department.name,
                    variant: r.variant.variantName,
                    sku: r.variant.sku,
                    batch: r.batch?.batchNumber ?? '',
                    quantity: Number(r.quantity),
                    balanceAfter: Number(r.balanceAfter),
                    performedBy: r.performedBy.fullName,
                    reference: r.referenceType
                        ? `${translateEnum(REFERENCE_TYPE_LABELS_AR, r.referenceType)}: ${r.referenceId}`
                        : '',
                    notes: r.notes ?? '',
                })),
            },
        ]);
    }

    private summaryToRows(
        summary: InventoryMovementSummary,
        from: Date,
        to: Date,
    ) {
        const rows: { metric: string; value: string | number }[] = [
            { metric: 'من تاريخ', value: from.toISOString().slice(0, 10) },
            { metric: 'إلى تاريخ', value: to.toISOString().slice(0, 10) },
            { metric: 'إجمالي عدد الحركات', value: summary.totalTransactions },
            { metric: 'إجمالي الكمية الواردة', value: summary.totalQuantityIn },
            {
                metric: 'إجمالي الكمية الصادرة',
                value: summary.totalQuantityOut,
            },
            { metric: 'صافي الكمية', value: summary.netQuantity },
        ];
        for (const t of summary.byTransactionType) {
            const label = translateEnum(
                TRANSACTION_TYPE_LABELS_AR,
                t.transactionType,
            );
            rows.push({ metric: `${label} - العدد`, value: t.count });
            rows.push({ metric: `${label} - الكمية`, value: t.totalQuantity });
        }
        return rows;
    }
    private async buildFilters(
        dto: ListInventoryMovementDto,
        requestingUserId: string,
    ): Promise<BuiltFilters> {
        const { from, to } = resolveReportDateRange(dto.from, dto.to);

        const scope =
            await this.reportAccessService.resolveDepartmentScope(
                requestingUserId,
            );
        if (scope && dto.departmentId && dto.departmentId !== scope) {
            throw new ForbiddenException(
                'يمكنك فقط عرض التقارير الخاصة بقسمك.',
            );
        }
        const departmentId = scope ?? dto.departmentId;

        const where: Prisma.InventoryTransactionWhereInput = {
            transactionDate: { gte: from, lte: to },
            departmentId,
            variantId: dto.variantId,
            transactionType: dto.transactionType,
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
