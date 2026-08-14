import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';
class StockSettingItemDto {
    @IsUUID()
    variantId!: string;

    @IsOptional()
    @IsString()
    storageLocation?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minimumStock?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    maximumStock?: number;
}

export class CreateStockSettingDto {
    @IsUUID()
    departmentId!: string;

    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => StockSettingItemDto)
    items!: StockSettingItemDto[];
}
