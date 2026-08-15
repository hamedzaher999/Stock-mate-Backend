import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
class RefillItemInputDto {
    @IsUUID()
    variantId!: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    requestedQuantity!: number;
}

export class UpdateRefillRequestDto {
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ArrayUnique((entry: RefillItemInputDto) => entry.variantId)
    @ValidateNested({ each: true })
    @Type(() => RefillItemInputDto)
    items?: RefillItemInputDto[];

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}
