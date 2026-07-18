import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { CancelPrescriptionDto } from './dto/cancel-prescription.dto';
import { RenewPrescriptionDto } from './dto/renew-prescription.dto';
import { ListPrescriptionsDto } from './dto/list-prescriptions.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequirePermissions } from '../../core/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../common/constants/permissions.constants';

@Controller('prescriptions')
export class PrescriptionsController {
    constructor(private readonly prescriptionsService: PrescriptionsService) {}

    @Get()
    @RequirePermissions(PERMISSIONS.VIEW_PATIENT_HISTORY)
    async findAll(@Query() query: ListPrescriptionsDto) {
        const data = await this.prescriptionsService.list(query);
        return { message: 'Success', data };
    }

    @Get(':id')
    @RequirePermissions(PERMISSIONS.VIEW_PATIENT_HISTORY)
    async findOne(@Param('id') id: string) {
        const data = await this.prescriptionsService.findById(id);
        return { message: 'Success', data };
    }

    @Post(':id/renew')
    @RequirePermissions(PERMISSIONS.RENEW_PRESCRIPTION)
    async renew(
        @Param('id') id: string,
        @Body() dto: RenewPrescriptionDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.prescriptionsService.renew(id, dto, user.sub);
        return { message: 'Prescription renewed.', data };
    }

    @Post(':id/cancel')
    @RequirePermissions(PERMISSIONS.CANCEL_PRESCRIPTION)
    async cancel(
        @Param('id') id: string,
        @Body() dto: CancelPrescriptionDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.prescriptionsService.cancel(id, dto, user.sub);
        return { message: 'Prescription cancelled.', data };
    }
}
