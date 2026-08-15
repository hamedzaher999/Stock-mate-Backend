import {
    IsArray,
    IsOptional,
    IsPositive,
    IsString,
    IsUUID,
    ValidateNested,
    ArrayMinSize,
    MaxLength,
    ArrayUnique,
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
    @ArrayUnique((entry: DispenseItemInputDto) => entry.prescriptionItemId)
    @ValidateNested({ each: true })
    @Type(() => DispenseItemInputDto)
    items!: DispenseItemInputDto[];

    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}
