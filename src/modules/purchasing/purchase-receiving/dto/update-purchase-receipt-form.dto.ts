import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
export class UpdatePurchaseReceiptFormDto {
    @IsOptional()
    @IsDateString()
    receivingDate?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;

    @IsOptional()
    @IsString()
    items?: string;

    @IsOptional()
    @IsString()
    removeImageIds?: string;
}
