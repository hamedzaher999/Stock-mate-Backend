import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { LookupPatientDto } from './dto/lookup-patient.dto';
import { ListPatientsDto } from './dto/list-patients.dto';
import { RequirePermissions } from '../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../common/constants/permissions.constants';

@Controller('patients')
export class PatientsController {
    constructor(private readonly patientsService: PatientsService) {}

    @Get()
    @RequirePermissions(PERMISSIONS.VIEW_PATIENTS)
    async findAll(@Query() query: ListPatientsDto) {
        const data = await this.patientsService.list(query);
        return { message: 'Success', data };
    }

    @Get('lookup')
    @RequirePermissions(PERMISSIONS.VIEW_PATIENTS)
    async lookup(@Query() query: LookupPatientDto) {
        const data = await this.patientsService.lookup(query);
        return {
            message: data ? 'Patient found.' : 'No matching patient found.',
            data,
        };
    }

    @Get(':id')
    @RequirePermissions(PERMISSIONS.VIEW_PATIENTS)
    async findOne(@Param('id') id: string) {
        const data = await this.patientsService.findById(id);
        return { message: 'Success', data };
    }

    @Post()
    @RequirePermissions(PERMISSIONS.ADD_PATIENT)
    async create(
        @Body() dto: CreatePatientDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.patientsService.create(dto, user.sub);
        return { message: 'Patient registered.', data };
    }

    @Patch(':id')
    @RequirePermissions(PERMISSIONS.ADD_PATIENT)
    async update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
        const data = await this.patientsService.update(id, dto);
        return { message: 'Patient record updated.', data };
    }
}
