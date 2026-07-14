import { IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateVariantDto {
  @IsUUID()
  productId!: string;

  @IsString()
  @MaxLength(150)
  variantName!: string;

  @IsString()
  @MaxLength(100)
  sku!: string;

  @IsUUID()
  unitId!: string;
}
