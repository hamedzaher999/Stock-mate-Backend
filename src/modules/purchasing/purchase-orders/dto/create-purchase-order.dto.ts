import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsDateString,
    IsNumber,
    IsOptional,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';

class PurchaseOrderItemInputDto {
    @IsUUID()
    purchaseRequestItemId!: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    orderedQuantity!: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    unitPrice?: number;
}

export class CreatePurchaseOrderDto {
    @IsUUID()
    purchaseRequestId!: string;

    @IsUUID()
    supplierId!: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => PurchaseOrderItemInputDto)
    items!: PurchaseOrderItemInputDto[];

    @IsOptional()
    @IsDateString()
    expectedDeliveryDate?: string;
}
