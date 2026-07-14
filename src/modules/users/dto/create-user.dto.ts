import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  fullName!: string;

  @ValidateIf((o: CreateUserDto) => !o.email)
  @IsString()
  phone?: string;

  @ValidateIf((o: CreateUserDto) => !o.phone)
  @IsEmail()
  email?: string;

  @IsUUID()
  roleId!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  specialty?: string;
}
