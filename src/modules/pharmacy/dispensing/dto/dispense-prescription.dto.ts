import {
    IsArray,
    IsOptional,
    IsPositive,
    IsString,
    IsUUID,
    ValidateNested,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class DispenseItemInputDto {
    @IsUUID()
    prescriptionItemId!: string;

    @IsPositive()
    quantity!: number;
}

export class DispensePrescriptionDto {
    @IsUUID()
    prescriptionId!: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => DispenseItemInputDto)
    items!: DispenseItemInputDto[];

    @IsOptional()
    @IsString()
    notes?: string;
}
