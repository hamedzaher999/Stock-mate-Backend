import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class ListPurchaseReceiptsDto extends PaginationDto {
    @IsOptional()
    @IsUUID()
    purchaseRequestId?: string;
}
