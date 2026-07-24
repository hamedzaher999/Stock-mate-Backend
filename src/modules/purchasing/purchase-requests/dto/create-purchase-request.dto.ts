import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';

class PurchaseRequestItemDto {
    @IsUUID()
    variantId!: string;

    @IsNumber()
    @Min(0.0001)
    requestedQuantity!: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    estimatedPrice?: number;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class CreatePurchaseRequestDto {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => PurchaseRequestItemDto)
    items!: PurchaseRequestItemDto[];

    @IsOptional()
    @IsString()
    notes?: string;
}
