import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsDateString,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
class UpdateReceiptItemDto {
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

export class UpdatePurchaseReceiptDto {
    @IsOptional()
    @IsDateString()
    receivingDate?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;

    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => UpdateReceiptItemDto)
    items?: UpdateReceiptItemDto[];
}
