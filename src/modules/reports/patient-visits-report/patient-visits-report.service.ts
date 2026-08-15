import {
    BadRequestException,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
    PatientVisitsReportRepository,
    PatientVisitsSummary,
} from './patient-visits-report.repository';
import { ListPatientVisitsReportDto } from './dto/list-patient-visits-report.dto';
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
    where: Prisma.MedicalVisitWhereInput;
    from: Date;
    to: Date;
    departmentId?: string;
    groupBy: ReportGroupBy;
}

@Injectable()
export class PatientVisitsReportService {
    constructor(
        private readonly repository: PatientVisitsReportRepository,
        private readonly reportAccessService: ReportAccessService,
        private readonly excelExportService: ExcelExportService,
    ) {}

    async getReport(dto: ListPatientVisitsReportDto, requestingUserId: string) {
        const filters = await this.buildFilters(dto, requestingUserId);
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const [summary, byDepartment, series, rowsPage] = await Promise.all([
            this.repository.getSummary(filters.where),
            this.repository.getDepartmentBreakdown(filters.where),
            this.repository.getSeries({
                from: filters.from,
                to: filters.to,
                departmentId: filters.departmentId,
                doctorId: dto.doctorId,
                patientId: dto.patientId,
                status: dto.status,
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
        dto: ListPatientVisitsReportDto,
        requestingUserId: string,
    ): Promise<Buffer> {
        const filters = await this.buildFilters(dto, requestingUserId);

        const rowCount = await this.repository.countRows(filters.where);
        if (rowCount > MAX_EXPORT_ROWS) {
            throw new BadRequestException(
                `This export would contain ${rowCount} rows, which exceeds the ${MAX_EXPORT_ROWS} limit -- narrow the date range or add a department/doctor filter.`,
            );
        }

        const [summary, byDepartment, rows] = await Promise.all([
            this.repository.getSummary(filters.where),
            this.repository.getDepartmentBreakdown(filters.where),
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
                    { header: 'Visit Count', key: 'visitCount', width: 16 },
                    {
                        header: 'Unique Patients',
                        key: 'uniquePatientCount',
                        width: 18,
                    },
                ],
                rows: byDepartment.map((d) => ({
                    department: d.departmentName,
                    visitCount: d.visitCount,
                    uniquePatientCount: d.uniquePatientCount,
                })),
            },
            {
                name: 'Visits',
                columns: [
                    { header: 'Date', key: 'date', width: 20 },
                    { header: 'Patient', key: 'patient', width: 24 },
                    { header: 'National ID', key: 'nationalId', width: 16 },
                    { header: 'Department', key: 'department', width: 22 },
                    { header: 'Doctor', key: 'doctor', width: 22 },
                    { header: 'Status', key: 'status', width: 14 },
                    { header: 'Cancel Reason', key: 'cancelReason', width: 32 },
                ],
                rows: rows.map((r) => ({
                    date: r.visitDate,
                    patient: r.patient.fullName,
                    nationalId: r.patient.nationalId ?? '',
                    department: r.department.name,
                    doctor: r.doctor.fullName,
                    status: r.status,
                    cancelReason: r.cancelReason ?? '',
                })),
            },
        ]);
    }

    private async buildFilters(
        dto: ListPatientVisitsReportDto,
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

        const where: Prisma.MedicalVisitWhereInput = {
            visitDate: { gte: from, lte: to },
            departmentId,
            doctorId: dto.doctorId,
            patientId: dto.patientId,
            status: dto.status,
        };

        const groupBy = pickDefaultGroupBy(from, to, dto.groupBy);

        return { where, from, to, departmentId, groupBy };
    }

    private summaryToRows(summary: PatientVisitsSummary, from: Date, to: Date) {
        const rows: { metric: string; value: string | number }[] = [
            { metric: 'From', value: from.toISOString().slice(0, 10) },
            { metric: 'To', value: to.toISOString().slice(0, 10) },
            { metric: 'Total Visits', value: summary.totalVisits },
            { metric: 'Unique Patients', value: summary.uniquePatients },
        ];
        for (const s of summary.byStatus) {
            rows.push({ metric: `${s.status} -- count`, value: s.count });
        }
        return rows;
    }
}
