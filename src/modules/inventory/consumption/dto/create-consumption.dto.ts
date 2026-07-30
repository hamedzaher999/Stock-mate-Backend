import {
    ArrayMinSize,
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
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
    @MaxLength(1000)
    notes?: string;
}
