import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { VisitStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListMedicalVisitsDto extends PaginationDto {
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
    @IsEnum(VisitStatus)
    status?: VisitStatus;
}
