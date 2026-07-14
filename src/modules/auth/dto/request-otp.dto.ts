import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  ValidateIf,
} from 'class-validator';
import { OtpChannel } from '@prisma/client';

export class RequestOtpDto {
  @ValidateIf((o: RequestOtpDto) => !o.email)
  @IsPhoneNumber('SY')
  phone?: string;

  @ValidateIf((o: RequestOtpDto) => !o.phone)
  @IsEmail()
  email?: string;

  @IsEnum(OtpChannel)
  @IsOptional()
  channel?: OtpChannel;
}
