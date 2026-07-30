import { Type } from 'class-transformer';
import {
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from 'class-validator';
export class UpdateStockCountItemDto {
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    countedQuantity!: number;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}
