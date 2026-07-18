import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateVariantDto {
    @IsOptional()
    @IsString()
    @MaxLength(150)
    variantName?: string;

    @IsOptional()
    @IsUUID()
    unitId?: string;
}
