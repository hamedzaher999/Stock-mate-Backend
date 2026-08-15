import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PatientVisitsReportService } from './patient-visits-report.service';
import { ListPatientVisitsReportDto } from './dto/list-patient-visits-report.dto';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';

@Controller('reports/patient-visits')
@RequirePermissions(PERMISSIONS.VIEW_REPORTS)
export class PatientVisitsReportController {
    constructor(
        private readonly patientVisitsReportService: PatientVisitsReportService,
    ) {}

    @Get()
    async get(
        @Query() query: ListPatientVisitsReportDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.patientVisitsReportService.getReport(
            query,
            user.sub,
        );
        return { message: 'Success', data };
    }

    @Get('export')
    async export(
        @Query() query: ListPatientVisitsReportDto,
        @CurrentUser() user: AuthenticatedUser,
        @Res() res: Response,
    ) {
        const buffer = await this.patientVisitsReportService.exportExcel(
            query,
            user.sub,
        );
        res.set({
            'Content-Type':
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="patient-visits-${Date.now()}.xlsx"`,
        });
        res.send(buffer);
    }
}
