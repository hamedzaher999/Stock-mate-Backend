import { Type } from 'class-transformer';
import {
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';

class VariantSupplierEntryDto {
    @IsUUID()
    supplierId!: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    expectedPurchasePrice?: number;

    @IsOptional()
    @IsString()
    supplierProductCode?: string;

    @IsOptional()
    @IsBoolean()
    isPreferred?: boolean;
}

export class SetVariantSuppliersDto {
    @IsArray()
    @ArrayUnique((entry: VariantSupplierEntryDto) => entry.supplierId)
    @ValidateNested({ each: true })
    @Type(() => VariantSupplierEntryDto)
    suppliers!: VariantSupplierEntryDto[];
}
