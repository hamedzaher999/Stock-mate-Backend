import { Injectable } from '@nestjs/common';
import { RegisterDeviceTokenDto } from '../dto/register-device-token.dto';
import { DeviceTokensRepository } from './device-tokens.repository';

@Injectable()
export class DeviceTokensService {
    constructor(
        private readonly deviceTokensRepository: DeviceTokensRepository,
    ) {}

    register(dto: RegisterDeviceTokenDto, userId: string) {
        return this.deviceTokensRepository.upsert({
            userId,
            platform: dto.platform,
            fcmToken: dto.fcmToken,
        });
    }

    unregister(fcmToken: string, userId: string) {
        return this.deviceTokensRepository.deleteForUserByToken(
            userId,
            fcmToken,
        );
    }
}
