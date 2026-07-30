import { Type } from 'class-transformer';
import {
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
} from 'class-validator';
export class AddStockCountItemDto {
    @IsUUID()
    variantId!: string;

    @IsOptional()
    @IsUUID()
    batchId?: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    countedQuantity!: number;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}
