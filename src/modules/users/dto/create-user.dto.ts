import {
    IsEmail,
    IsOptional,
    IsPhoneNumber,
    IsString,
    IsUUID,
    MaxLength,
    ValidateIf,
} from 'class-validator';
export class CreateUserDto {
    @IsString()
    @MaxLength(150)
    fullName!: string;

    @ValidateIf((o: CreateUserDto) => !o.email)
    @IsPhoneNumber('SY')
    phone?: string;

    @ValidateIf((o: CreateUserDto) => !o.phone)
    @IsEmail()
    @MaxLength(150)
    email?: string;

    @IsUUID()
    roleId!: string;

    @IsOptional()
    @IsUUID()
    departmentId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    specialty?: string;
}
