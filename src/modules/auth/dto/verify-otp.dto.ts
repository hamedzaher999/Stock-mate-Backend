import {
    IsEmail,
    IsString,
    IsEnum,
    ValidateIf,
    IsPhoneNumber,
} from 'class-validator';
import { SessionPlatform } from '@prisma/client';

export class VerifyOtpDto {
    @ValidateIf((o: VerifyOtpDto) => !o.email)
    @IsPhoneNumber('SY')
    phone?: string;

    @ValidateIf((o: VerifyOtpDto) => !o.phone)
    @IsEmail()
    email?: string;

    @IsString()
    code!: string;

    @IsEnum(SessionPlatform)
    platform!: SessionPlatform;
}
