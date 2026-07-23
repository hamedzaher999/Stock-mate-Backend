import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsDateString,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';

export class UpdatePurchaseReceiptItemDto {
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
    @Min(0)
    purchasePrice?: number;
}

export class UpdatePurchaseReceiptDto {
    @IsOptional()
    @IsDateString()
    receivingDate?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => UpdatePurchaseReceiptItemDto)
    items?: UpdatePurchaseReceiptItemDto[];
}
