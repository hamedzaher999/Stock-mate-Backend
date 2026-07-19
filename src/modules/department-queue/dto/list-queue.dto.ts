import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { QueueStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListQueueDto extends PaginationDto {
    @IsOptional()
    @IsUUID()
    departmentId?: string;

    @IsOptional()
    @IsEnum(QueueStatus)
    status?: QueueStatus;

    @IsOptional()
    @IsString()
    search?: string;
}
