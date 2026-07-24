import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';
import { BatchType } from '@prisma/client';

class DeliveryItemInputDto {
    @IsUUID()
    refillItemId!: string;

    @IsUUID()
    batchId!: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    shippedQuantity!: number;
}

export class CreateDeliveryDto {
    @IsUUID()
    refillRequestId!: string;

    @IsOptional()
    @IsEnum(BatchType)
    type?: BatchType;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => DeliveryItemInputDto)
    items!: DeliveryItemInputDto[];

    @IsOptional()
    @IsString()
    notes?: string;
}
