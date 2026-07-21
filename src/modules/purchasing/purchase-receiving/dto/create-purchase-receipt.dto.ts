import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsDateString,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { CreatePurchaseReceiptItemDto } from './create-purchase-receipt-item.dto';

export class CreatePurchaseReceiptDto {
    @IsUUID()
    purchaseOrderId!: string;

    @IsDateString()
    receivingDate!: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @ValidateNested({ each: true })
    @Type(() => CreatePurchaseReceiptItemDto)
    @ArrayMinSize(1)
    items!: CreatePurchaseReceiptItemDto[];
}
