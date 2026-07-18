import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateStockSettingDto {
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
