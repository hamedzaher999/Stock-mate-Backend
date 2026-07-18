import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCategoryDto {
    @IsString()
    @MaxLength(100)
    name!: string;

    @IsOptional()
    @IsUUID()
    parentCategoryId?: string;
}
