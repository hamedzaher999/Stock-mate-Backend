import { Type } from 'class-transformer';
import {
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
} from 'class-validator';
import { AdjustmentType } from '@prisma/client';
export class CreateAdjustmentDto {
    @IsUUID()
    variantId!: string;

    @IsUUID()
    departmentId!: string;

    @IsUUID()
    batchId!: string;

    @IsEnum(AdjustmentType)
    adjustmentType!: AdjustmentType;

    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    quantity!: number;

    @IsOptional()
    @IsUUID()
    stockCountSessionId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}
