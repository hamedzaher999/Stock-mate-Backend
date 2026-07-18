import {
    IsBooleanString,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';
import { MaterialType } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class ListProductsDto extends PaginationDto {
    @IsOptional()
    @IsUUID()
    categoryId?: string;

    @IsOptional()
    @IsEnum(MaterialType)
    materialType?: MaterialType;

    @IsOptional()
    @IsBooleanString()
    isActive?: string;

    @IsOptional()
    @IsString()
    search?: string;
}
