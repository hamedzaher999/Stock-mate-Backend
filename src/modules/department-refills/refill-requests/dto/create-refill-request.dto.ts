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

class RefillItemInputDto {
  @IsUUID()
  variantId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  requestedQuantity!: number;
}

export class CreateRefillRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RefillItemInputDto)
  items!: RefillItemInputDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
