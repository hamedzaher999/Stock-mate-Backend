import { IsBooleanString, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListSuppliersDto extends PaginationDto {
    @IsOptional()
    @IsBooleanString()
    isActive?: string;

    @IsOptional()
    @IsString()
    search?: string;
}
