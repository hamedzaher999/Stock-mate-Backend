import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';

class ConfirmedDisposalItemDto {
    @IsUUID()
    disposalTransferItemId!: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    confirmedQuantity!: number;
}

export class ConfirmDisposalTransferDto {
    @IsArray()
    @ArrayMinSize(1)
    @ArrayUnique(
        (entry: ConfirmedDisposalItemDto) => entry.disposalTransferItemId,
    )
    @ValidateNested({ each: true })
    @Type(() => ConfirmedDisposalItemDto)
    items!: ConfirmedDisposalItemDto[];

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}
