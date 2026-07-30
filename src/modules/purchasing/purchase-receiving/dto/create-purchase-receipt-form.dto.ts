import {
    IsDateString,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
} from 'class-validator';
import { BatchTypeDto } from '../../../../common/enums/batch-type.enum';

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
    @MaxLength(1000)
    notes?: string;

    @IsString()
    items!: string;
}
