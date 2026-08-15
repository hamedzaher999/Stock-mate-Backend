import { TransactionType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { ReportGroupBy } from '../../../../common/enums/report-group-by.enum';

export class ListInventoryMovementDto extends PaginationDto {
    @IsDateString()
    from!: string;

    @IsDateString()
    to!: string;

    @IsOptional()
    @IsUUID()
    departmentId?: string;

    @IsOptional()
    @IsUUID()
    variantId?: string;

    @IsOptional()
    @IsEnum(TransactionType)
    transactionType?: TransactionType;

    @IsOptional()
    @IsEnum(ReportGroupBy)
    groupBy?: ReportGroupBy;
}
