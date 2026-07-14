import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MaterialType } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsEnum(MaterialType)
  materialType!: MaterialType;

  @IsOptional()
  @IsString()
  description?: string;
}
