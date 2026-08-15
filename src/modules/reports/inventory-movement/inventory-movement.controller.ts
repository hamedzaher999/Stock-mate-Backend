import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { InventoryMovementReportService } from './inventory-movement.service';
import { ListInventoryMovementDto } from './dto/list-inventory-movement.dto';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';

@Controller('reports/inventory-movement')
@RequirePermissions(PERMISSIONS.VIEW_REPORTS)
export class InventoryMovementReportController {
    constructor(
        private readonly inventoryMovementReportService: InventoryMovementReportService,
    ) {}

    @Get()
    async get(
        @Query() query: ListInventoryMovementDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.inventoryMovementReportService.getReport(
            query,
            user.sub,
        );
        return { message: 'Success', data };
    }

    @Get('export')
    async export(
        @Query() query: ListInventoryMovementDto,
        @CurrentUser() user: AuthenticatedUser,
        @Res() res: Response,
    ) {
        const buffer = await this.inventoryMovementReportService.exportExcel(
            query,
            user.sub,
        );
        res.set({
            'Content-Type':
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="inventory-movement-${Date.now()}.xlsx"`,
        });
        res.send(buffer);
    }
}
