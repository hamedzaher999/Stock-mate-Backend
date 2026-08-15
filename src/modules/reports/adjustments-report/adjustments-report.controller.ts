import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AdjustmentsReportService } from './adjustments-report.service';
import { ListAdjustmentsReportDto } from './dto/list-adjustments-report.dto';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';

@Controller('reports/adjustments')
@RequirePermissions(PERMISSIONS.VIEW_REPORTS)
export class AdjustmentsReportController {
    constructor(
        private readonly adjustmentsReportService: AdjustmentsReportService,
    ) {}

    @Get()
    async get(
        @Query() query: ListAdjustmentsReportDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.adjustmentsReportService.getReport(
            query,
            user.sub,
        );
        return { message: 'Success', data };
    }

    @Get('export')
    async export(
        @Query() query: ListAdjustmentsReportDto,
        @CurrentUser() user: AuthenticatedUser,
        @Res() res: Response,
    ) {
        const buffer = await this.adjustmentsReportService.exportExcel(
            query,
            user.sub,
        );
        res.set({
            'Content-Type':
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="adjustments-${Date.now()}.xlsx"`,
        });
        res.send(buffer);
    }
}
