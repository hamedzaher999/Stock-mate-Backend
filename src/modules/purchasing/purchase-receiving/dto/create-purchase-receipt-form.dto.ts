import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePurchaseReceiptFormDto {
    @IsUUID()
    purchaseOrderId!: string;

    @IsDateString()
    receivingDate!: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsString()
    items!: string;
}
