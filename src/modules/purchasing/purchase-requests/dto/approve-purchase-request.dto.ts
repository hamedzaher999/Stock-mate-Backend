import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsNumber,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';

class ApprovedItemDto {
    @IsUUID()
    purchaseRequestItemId!: string;

    @IsNumber()
    @Min(0)
    approvedQuantity!: number;
}

export class ApprovePurchaseRequestDto {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ApprovedItemDto)
    items!: ApprovedItemDto[];
}
