import { Type } from 'class-transformer';
import {
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';

class ConfirmPurchaseReceiptItemDto {
    @IsUUID()
    purchaseReceiptItemId!: string;

    @IsNumber()
    @Min(0)
    confirmedQuantity!: number;
}

export class ConfirmPurchaseReceiptDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ConfirmPurchaseReceiptItemDto)
    items!: ConfirmPurchaseReceiptItemDto[];

    @IsOptional()
    @IsString()
    notes?: string;
}
