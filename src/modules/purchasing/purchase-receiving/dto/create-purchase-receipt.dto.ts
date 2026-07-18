import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsDateString,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';

class PurchaseReceiptItemInputDto {
    @IsUUID()
    purchaseOrderItemId!: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    quantity!: number;

    @IsString()
    batchNumber!: string;

    @IsOptional()
    @IsDateString()
    manufacturingDate?: string;

    @IsOptional()
    @IsDateString()
    expirationDate?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    purchasePrice?: number;
}

export class CreatePurchaseReceiptDto {
    @IsUUID()
    purchaseOrderId!: string;

    @IsDateString()
    receivingDate!: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => PurchaseReceiptItemInputDto)
    items!: PurchaseReceiptItemInputDto[];
}
