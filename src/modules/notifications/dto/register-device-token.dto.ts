import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { SessionPlatform } from '@prisma/client';

export class RegisterDeviceTokenDto {
    @IsString()
    @IsNotEmpty()
    fcmToken!: string;

    @IsEnum(SessionPlatform)
    platform!: SessionPlatform;
}
