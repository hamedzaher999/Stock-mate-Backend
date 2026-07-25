import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsDateString,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';

enum BatchTypeDto {
    batch = 'batch',
    final_batch = 'final_batch',
}

class ReceiptItemDto {
    @IsUUID()
    purchaseRequestItemId!: string;

    @IsNumber()
    @Min(0.0001)
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
    @Min(0)
    purchasePrice?: number;
}

export class CreatePurchaseReceiptDto {
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

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ReceiptItemDto)
    items!: ReceiptItemDto[];
}
