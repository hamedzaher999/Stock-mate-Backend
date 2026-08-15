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
    ) {}

    async getReport(dto: ListInventoryMovementDto, requestingUserId: string) {
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
                transactionType: dto.transactionType,
            }),
            this.repository.findAllRowsForExport(filters.where),
        ]);

        return this.excelExportService.buildWorkbook([
            {
                name: 'Summary',
                columns: [
                    { header: 'Metric', key: 'metric', width: 32 },
                    { header: 'Value', key: 'value', width: 20 },
                ],
                rows: this.summaryToRows(summary, filters.from, filters.to),
            },
            {
                name: 'By Department',
                columns: [
                    { header: 'Department', key: 'department', width: 24 },
                    { header: 'Transactions', key: 'count', width: 14 },
                    {
                        header: 'Quantity In',
                        key: 'quantityIn',
                        width: 16,
                        numFmt: '#,##0.00',
                    },
                    {
                        header: 'Quantity Out',
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
                name: 'Transactions',
                columns: [
                    { header: 'Date', key: 'date', width: 20 },
                    { header: 'Type', key: 'type', width: 24 },
                    { header: 'Department', key: 'department', width: 22 },
                    { header: 'Variant', key: 'variant', width: 28 },
                    { header: 'SKU', key: 'sku', width: 16 },
                    { header: 'Batch', key: 'batch', width: 16 },
                    {
                        header: 'Quantity',
                        key: 'quantity',
                        width: 14,
                        numFmt: '#,##0.00',
                    },
                    {
                        header: 'Balance After',
                        key: 'balanceAfter',
                        width: 16,
                        numFmt: '#,##0.00',
                    },
                    { header: 'Performed By', key: 'performedBy', width: 22 },
                    { header: 'Reference', key: 'reference', width: 26 },
                    { header: 'Notes', key: 'notes', width: 32 },
                ],
                rows: rows.map((r) => ({
                    date: r.transactionDate,
                    type: r.transactionType,
                    department: r.department.name,
                    variant: r.variant.variantName,
                    sku: r.variant.sku,
                    batch: r.batch?.batchNumber ?? '',
                    quantity: Number(r.quantity),
                    balanceAfter: Number(r.balanceAfter),
                    performedBy: r.performedBy.fullName,
                    reference: r.referenceType
                        ? `${r.referenceType}:${r.referenceId}`
                        : '',
                    notes: r.notes ?? '',
                })),
            },
        ]);
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
                'You can only view reports for your own department.',
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

    private summaryToRows(
        summary: InventoryMovementSummary,
        from: Date,
        to: Date,
    ) {
        const rows: { metric: string; value: string | number }[] = [
            { metric: 'From', value: from.toISOString().slice(0, 10) },
            { metric: 'To', value: to.toISOString().slice(0, 10) },
            { metric: 'Total Transactions', value: summary.totalTransactions },
            { metric: 'Total Quantity In', value: summary.totalQuantityIn },
            { metric: 'Total Quantity Out', value: summary.totalQuantityOut },
            { metric: 'Net Quantity', value: summary.netQuantity },
        ];
        for (const t of summary.byTransactionType) {
            rows.push({
                metric: `${t.transactionType} -- count`,
                value: t.count,
            });
            rows.push({
                metric: `${t.transactionType} -- quantity`,
                value: t.totalQuantity,
            });
        }
        return rows;
    }
}
