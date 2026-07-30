import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
export class CreateSupplierDto {
    @IsString()
    @MaxLength(150)
    name!: string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    phone?: string;

    @IsOptional()
    @IsEmail()
    @MaxLength(150)
    email?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;
}
