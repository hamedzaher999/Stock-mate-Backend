import {
    IsDateString,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

enum BatchTypeDto {
    batch = 'batch',
    final_batch = 'final_batch',
}

export class CreatePurchaseReceiptFormDto {
    @IsUUID()
    purchaseRequestId!: string;

    @IsUUID()
    supplierId!: string;

    @IsDateString()
    receivingDate!: string;

    @IsOptional()
    @IsEnum(BatchTypeDto)
    type?: BatchTypeDto;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsString()
    items!: string;
}
