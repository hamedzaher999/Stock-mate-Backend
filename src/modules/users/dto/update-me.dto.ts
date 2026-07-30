import { IsEmail, IsOptional, IsPhoneNumber, MaxLength } from 'class-validator';

export class UpdateMeDto {
    @IsOptional()
    @IsPhoneNumber('SY')
    phone?: string;

    @IsOptional()
    @IsEmail()
    @MaxLength(150)
    email?: string;
}
