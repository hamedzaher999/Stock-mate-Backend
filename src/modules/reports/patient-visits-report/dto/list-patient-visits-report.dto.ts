import { VisitStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { ReportGroupBy } from '../../../../common/enums/report-group-by.enum';

export class ListPatientVisitsReportDto extends PaginationDto {
    @IsDateString()
    from!: string;

    @IsDateString()
    to!: string;

    @IsOptional()
    @IsUUID()
    departmentId?: string;

    @IsOptional()
    @IsUUID()
    doctorId?: string;

    @IsOptional()
    @IsUUID()
    patientId?: string;

    @IsOptional()
    @IsEnum(VisitStatus)
    status?: VisitStatus;

    @IsOptional()
    @IsEnum(ReportGroupBy)
    groupBy?: ReportGroupBy;
}
