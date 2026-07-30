import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CycleStatus, PrescriptionStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListPrescriptionsDto extends PaginationDto {
    @IsOptional()
    @IsUUID()
    patientId?: string;

    @IsOptional()
    @IsUUID()
    doctorId?: string;

    @IsOptional()
    @IsUUID()
    departmentId?: string;

    @IsOptional()
    @IsEnum(PrescriptionStatus)
    status?: PrescriptionStatus;

    @IsOptional()
    @IsEnum(CycleStatus)
    cycleStatus?: CycleStatus;
}
