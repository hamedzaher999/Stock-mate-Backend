import {
    IsDateString,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    IsUUID,
} from 'class-validator';

export class CreatePurchaseReceiptItemDto {
    @IsUUID()
    purchaseOrderItemId!: string;

    @IsNumber()
    @IsPositive()
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
    @IsNumber()
    purchasePrice?: number;
}
