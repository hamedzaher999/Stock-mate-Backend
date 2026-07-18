import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsNumber,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';

class PreparedItemDto {
    @IsUUID()
    refillItemId!: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    preparedQuantity!: number;
}

export class PrepareRefillRequestDto {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => PreparedItemDto)
    items!: PreparedItemDto[];
}
