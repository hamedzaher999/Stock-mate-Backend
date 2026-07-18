import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MedicalVisitsService } from './medical-visits.service';
import { SelectPatientDto } from './dto/select-patient.dto';
import { CompleteConsultationDto } from './dto/complete-consultation.dto';
import { CancelVisitDto } from './dto/cancel-visit.dto';
import { ListMedicalVisitsDto } from './dto/list-medical-visits.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequirePermissions } from '../../core/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../common/constants/permissions.constants';

@Controller('medical-visits')
export class MedicalVisitsController {
    constructor(private readonly medicalVisitsService: MedicalVisitsService) {}

    @Get()
    @RequirePermissions(PERMISSIONS.VIEW_PATIENT_HISTORY)
    async findAll(
        @Query() query: ListMedicalVisitsDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.medicalVisitsService.list(query, user.sub);
        return { message: 'Success', data };
    }

    @Get('patient/:patientId/history')
    @RequirePermissions(PERMISSIONS.VIEW_PATIENT_HISTORY)
    async patientHistory(@Param('patientId') patientId: string) {
        const data =
            await this.medicalVisitsService.getPatientHistory(patientId);
        return { message: 'Success', data };
    }

    @Get(':id')
    @RequirePermissions(PERMISSIONS.VIEW_PATIENT_HISTORY)
    async findOne(@Param('id') id: string) {
        const data = await this.medicalVisitsService.findById(id);
        return { message: 'Success', data };
    }

    @Post('select')
    @RequirePermissions(PERMISSIONS.START_CONSULTATION)
    async select(
        @Body() dto: SelectPatientDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.medicalVisitsService.selectPatient(
            dto,
            user.sub,
        );
        return { message: 'Patient selected for consultation.', data };
    }

    @Post('complete')
    @RequirePermissions(PERMISSIONS.START_CONSULTATION)
    async complete(
        @Body() dto: CompleteConsultationDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.medicalVisitsService.completeConsultation(
            dto,
            user.sub,
        );
        return { message: 'Consultation completed and visit recorded.', data };
    }

    @Post(':id/cancel')
    async cancel(
        @Param('id') id: string,
        @Body() dto: CancelVisitDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.medicalVisitsService.cancel(id, dto, user.sub);
        return { message: 'Visit cancelled.', data };
    }
}
