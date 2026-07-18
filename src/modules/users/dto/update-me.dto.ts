import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateMeDto {
    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsEmail()
    email?: string;
}
