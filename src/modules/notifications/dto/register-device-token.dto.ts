import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { SessionPlatform } from '@prisma/client';
export class RegisterDeviceTokenDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    fcmToken!: string;

    @IsEnum(SessionPlatform)
    platform!: SessionPlatform;
}
