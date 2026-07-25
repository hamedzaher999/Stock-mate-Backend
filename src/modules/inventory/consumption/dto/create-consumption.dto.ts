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
import { Type } from 'class-transformer';

class ConsumptionLineDto {
    @IsUUID()
    variantId!: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    quantity!: number;
}

export class CreateConsumptionDto {
    @IsUUID()
    departmentId!: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ConsumptionLineDto)
    items!: ConsumptionLineDto[];

    @IsOptional()
    @IsString()
    notes?: string;
}
