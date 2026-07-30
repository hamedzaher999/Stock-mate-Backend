import {
    IsEmail,
    IsOptional,
    IsPhoneNumber,
    IsString,
    IsUUID,
    MaxLength,
} from 'class-validator';
export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @MaxLength(150)
    fullName?: string;

    @IsOptional()
    @IsPhoneNumber('SY')
    phone?: string;

    @IsOptional()
    @IsEmail()
    @MaxLength(150)
    email?: string;

    @IsOptional()
    @IsUUID()
    roleId?: string;

    @IsOptional()
    @IsUUID()
    departmentId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    specialty?: string;
}
