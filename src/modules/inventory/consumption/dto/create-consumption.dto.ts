import {
    ArrayMinSize,
    IsArray,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ConsumptionLineDto {
    @IsUUID()
    variantId!: string;

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
