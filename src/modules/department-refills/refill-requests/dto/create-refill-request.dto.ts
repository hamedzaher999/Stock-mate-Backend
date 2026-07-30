import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsEnum,
    IsInt,
    IsOptional,
    IsPositive,
    IsString,
    IsUUID,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { RefillRequestPriority, RefillRequestType } from '@prisma/client';
class RefillRequestItemInputDto {
    @IsUUID()
    variantId!: string;

    @IsPositive()
    requestedQuantity!: number;
}

export class CreateRefillRequestDto {
    @IsOptional()
    @IsEnum(RefillRequestPriority)
    priority?: RefillRequestPriority;

    @IsOptional()
    @IsEnum(RefillRequestType)
    requestType?: RefillRequestType;

    @IsOptional()
    @IsInt()
    @Min(1)
    frequencyInterval?: number;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => RefillRequestItemInputDto)
    items!: RefillRequestItemInputDto[];
}
