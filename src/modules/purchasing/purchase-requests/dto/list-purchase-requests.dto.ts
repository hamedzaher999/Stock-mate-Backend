import { IsEnum, IsOptional } from 'class-validator';
import { PurchaseRequestStatus } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class ListPurchaseRequestsDto extends PaginationDto {
    @IsOptional()
    @IsEnum(PurchaseRequestStatus)
    status?: PurchaseRequestStatus;
}
