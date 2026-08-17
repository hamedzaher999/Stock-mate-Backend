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

class DisposalSaleItemInputDto {
    @IsUUID()
    variantId!: string;

    @IsUUID()
    batchId!: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    quantity!: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    price!: number;
}

export class CreateDisposalSaleRequestDto {
    @IsUUID()
    destinationId!: string;

    @IsArray()
    @ArrayMinSize(1)
    @ArrayUnique((entry: DisposalSaleItemInputDto) => entry.batchId)
    @ValidateNested({ each: true })
    @Type(() => DisposalSaleItemInputDto)
    items!: DisposalSaleItemInputDto[];

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}
