import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { StockCountStatus } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class ListStockCountSessionsDto extends PaginationDto {
    @IsOptional()
    @IsUUID()
    departmentId?: string;

    @IsOptional()
    @IsEnum(StockCountStatus)
    status?: StockCountStatus;
}
