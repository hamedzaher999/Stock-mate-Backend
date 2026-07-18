import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListBatchesDto extends PaginationDto {
    @IsOptional()
    @IsUUID()
    variantId?: string;

    @IsOptional()
    @IsUUID()
    departmentId?: string;
}
