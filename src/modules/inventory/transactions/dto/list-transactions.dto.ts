import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TransactionType } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class ListTransactionsDto extends PaginationDto {
    @IsOptional()
    @IsUUID()
    departmentId?: string;

    @IsOptional()
    @IsUUID()
    variantId?: string;

    @IsOptional()
    @IsUUID()
    batchId?: string;

    @IsOptional()
    @IsEnum(TransactionType)
    transactionType?: TransactionType;
}
