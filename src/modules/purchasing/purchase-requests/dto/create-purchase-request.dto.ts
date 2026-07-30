import { RefillRequestPriority } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
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
    @MaxLength(500)
    notes?: string;
}

export class CreatePurchaseRequestDto {
    @IsOptional()
    @IsEnum(RefillRequestPriority)
    priority?: RefillRequestPriority;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => PurchaseRequestItemDto)
    items!: PurchaseRequestItemDto[];

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}
