import { Injectable } from '@nestjs/common';
import { Prisma, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ReportGroupBy } from '../../../common/enums/report-group-by.enum';

const visitReportRowSelect = {
    id: true,
    patientId: true,
    doctorId: true,
    departmentId: true,
    visitDate: true,
    status: true,
    cancelReason: true,
    patient: {
        select: { id: true, fullName: true, nationalId: true, patientId: true },
    },
    doctor: { select: { id: true, fullName: true, specialty: true } },
    department: { select: { id: true, name: true } },
} satisfies Prisma.MedicalVisitSelect;

export interface PatientVisitsSummary {
    totalVisits: number;
    uniquePatients: number;
    byStatus: { status: string; count: number }[];
}

export interface PatientVisitsSeriesPoint {
    bucket: string;
    visitCount: number;
}

export interface PatientVisitsDepartmentBreakdownRow {
    departmentId: string;
    departmentName: string;
    visitCount: number;
    uniquePatientCount: number;
}

@Injectable()
export class PatientVisitsReportRepository {
    constructor(private readonly prisma: PrismaService) {}

    async getSummary(
        where: Prisma.MedicalVisitWhereInput,
    ): Promise<PatientVisitsSummary> {
        const [totalVisits, byStatus, distinctPatients] = await Promise.all([
            this.prisma.medicalVisit.count({ where }),
            this.prisma.medicalVisit.groupBy({
                by: ['status'],
                where,
                orderBy: { status: 'asc' },
                _count: { _all: true },
            }),
            this.prisma.medicalVisit.findMany({
                where,
                distinct: ['patientId'],
                select: { patientId: true },
            }),
        ]);

        return {
            totalVisits,
            uniquePatients: distinctPatients.length,
            byStatus: byStatus.map((s) => ({
                status: s.status,
                count: s._count._all,
            })),
        };
    }

    async getDepartmentBreakdown(
        where: Prisma.MedicalVisitWhereInput,
    ): Promise<PatientVisitsDepartmentBreakdownRow[]> {
        const [byDepartment, distinctPairs] = await Promise.all([
            this.prisma.medicalVisit.groupBy({
                by: ['departmentId'],
                where,
                orderBy: { departmentId: 'asc' },
                _count: { _all: true },
            }),
            this.prisma.medicalVisit.findMany({
                where,
                distinct: ['patientId', 'departmentId'],
                select: { patientId: true, departmentId: true },
            }),
        ]);

        if (byDepartment.length === 0) return [];

        const departments = await this.prisma.department.findMany({
            where: { id: { in: byDepartment.map((d) => d.departmentId) } },
            select: { id: true, name: true },
        });
        const nameById = new Map(departments.map((d) => [d.id, d.name]));

        const uniqueCountByDept = new Map<string, number>();
        for (const pair of distinctPairs) {
            uniqueCountByDept.set(
                pair.departmentId,
                (uniqueCountByDept.get(pair.departmentId) ?? 0) + 1,
            );
        }

        return byDepartment.map((d) => ({
            departmentId: d.departmentId,
            departmentName: nameById.get(d.departmentId) ?? 'Unknown',
            visitCount: d._count._all,
            uniquePatientCount: uniqueCountByDept.get(d.departmentId) ?? 0,
        }));
    }

    async getSeries(params: {
        from: Date;
        to: Date;
        departmentId?: string;
        doctorId?: string;
        patientId?: string;
        status?: VisitStatus;
        bucket: ReportGroupBy;
    }): Promise<PatientVisitsSeriesPoint[]> {
        const conditions: Prisma.Sql[] = [
            Prisma.sql`visit_date >= ${params.from}`,
            Prisma.sql`visit_date <= ${params.to}`,
        ];
        if (params.departmentId) {
            conditions.push(
                Prisma.sql`department_id = ${params.departmentId}::uuid`,
            );
        }
        if (params.doctorId) {
            conditions.push(Prisma.sql`doctor_id = ${params.doctorId}::uuid`);
        }
        if (params.patientId) {
            conditions.push(Prisma.sql`patient_id = ${params.patientId}::uuid`);
        }
        if (params.status) {
            conditions.push(
                Prisma.sql`status = ${params.status}::visit_status`,
            );
        }

        const whereClause = Prisma.join(conditions, ' AND ');

        const rows = await this.prisma.$queryRaw<
            { bucket: Date; visitCount: number }[]
        >`
            SELECT
                date_trunc(${params.bucket}, visit_date) AS "bucket",
                COUNT(*)::int AS "visitCount"
            FROM medical_visits
            WHERE ${whereClause}
            GROUP BY 1
            ORDER BY 1
        `;

        return rows.map((r) => ({
            bucket: r.bucket.toISOString().slice(0, 10),
            visitCount: r.visitCount,
        }));
    }

    async countRows(where: Prisma.MedicalVisitWhereInput) {
        return this.prisma.medicalVisit.count({ where });
    }

    async findRows(
        where: Prisma.MedicalVisitWhereInput,
        skip: number,
        take: number,
    ) {
        const [items, total] = await Promise.all([
            this.prisma.medicalVisit.findMany({
                where,
                select: visitReportRowSelect,
                skip,
                take,
                orderBy: { visitDate: 'desc' },
            }),
            this.prisma.medicalVisit.count({ where }),
        ]);
        return { items, total };
    }

    async findAllRowsForExport(where: Prisma.MedicalVisitWhereInput) {
        return this.prisma.medicalVisit.findMany({
            where,
            select: visitReportRowSelect,
            orderBy: { visitDate: 'asc' },
        });
    }
}
