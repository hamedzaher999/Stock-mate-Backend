import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PeriodicScheduleStatus } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class ListPeriodicSchedulesDto extends PaginationDto {
    @IsOptional()
    @IsUUID()
    departmentId?: string;

    @IsOptional()
    @IsEnum(PeriodicScheduleStatus)
    status?: PeriodicScheduleStatus;
}
