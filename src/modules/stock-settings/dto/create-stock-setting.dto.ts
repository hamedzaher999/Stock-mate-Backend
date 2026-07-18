import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateStockSettingDto {
    @IsUUID()
    variantId!: string;

    @IsUUID()
    departmentId!: string;

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
