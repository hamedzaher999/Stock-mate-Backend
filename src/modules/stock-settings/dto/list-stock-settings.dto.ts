import { IsBooleanString, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListStockSettingsDto extends PaginationDto {
    @IsOptional()
    @IsUUID()
    departmentId?: string;

    @IsOptional()
    @IsUUID()
    variantId?: string;

    @IsOptional()
    @IsBooleanString()
    isActive?: string;
}
