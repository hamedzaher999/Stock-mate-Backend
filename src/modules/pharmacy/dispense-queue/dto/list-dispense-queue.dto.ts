import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { CycleStatus } from '@prisma/client';

export class ListDispenseQueueDto extends PaginationDto {
    @IsOptional()
    @IsEnum(CycleStatus)
    status?: CycleStatus;
}
