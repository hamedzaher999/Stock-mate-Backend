import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class ListDeliveriesDto extends PaginationDto {
    @IsOptional()
    @IsUUID()
    refillRequestId?: string;
}
