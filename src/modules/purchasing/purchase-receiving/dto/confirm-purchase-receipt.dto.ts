import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';

class ConfirmedReceiptItemDto {
    @IsUUID()
    purchaseReceiptItemId!: string;

    @IsNumber()
    @Min(0)
    confirmedQuantity!: number;
}
export class ConfirmPurchaseReceiptDto {
    @IsArray()
    @ArrayMinSize(1)
    @ArrayUnique(
        (entry: ConfirmedReceiptItemDto) => entry.purchaseReceiptItemId,
    )
    @ValidateNested({ each: true })
    @Type(() => ConfirmedReceiptItemDto)
    items!: ConfirmedReceiptItemDto[];

    @IsOptional()
    @IsString()
    notes?: string;
}
