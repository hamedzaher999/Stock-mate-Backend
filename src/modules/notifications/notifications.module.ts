import { Global, Module } from '@nestjs/common';
import { DeviceTokensRepository } from './device-tokens/device-tokens.repository';
import { DeviceTokensService } from './device-tokens/device-tokens.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { PushService } from './push/push.service';

@Global()
@Module({
    controllers: [NotificationsController],
    providers: [
        NotificationsService,
        NotificationsRepository,
        DeviceTokensService,
        DeviceTokensRepository,
        PushService,
    ],
    exports: [NotificationsService],
})
export class NotificationsModule {}
