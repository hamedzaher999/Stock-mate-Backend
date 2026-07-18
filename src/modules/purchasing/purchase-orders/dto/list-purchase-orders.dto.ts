import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PurchaseOrderStatus } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class ListPurchaseOrdersDto extends PaginationDto {
    @IsOptional()
    @IsUUID()
    purchaseRequestId?: string;

    @IsOptional()
    @IsEnum(PurchaseOrderStatus)
    status?: PurchaseOrderStatus;
}
