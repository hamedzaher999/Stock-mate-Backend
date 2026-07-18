import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';

class ConfirmedItemDto {
    @IsUUID()
    deliveryItemId!: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    receivedQuantity!: number;
}

export class ConfirmDeliveryDto {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ConfirmedItemDto)
    items!: ConfirmedItemDto[];

    @IsOptional()
    @IsString()
    notes?: string;
}
