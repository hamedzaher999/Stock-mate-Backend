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
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { BatchTypeDto } from '../../../../common/enums/batch-type.enum';

class ReceiptItemDto {
    @IsUUID()
    purchaseRequestItemId!: string;

    @IsNumber()
    @Min(0.0001)
    quantity!: number;

    @IsString()
    @MaxLength(150)
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
    @MaxLength(1000)
    notes?: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ReceiptItemDto)
    items!: ReceiptItemDto[];
}
