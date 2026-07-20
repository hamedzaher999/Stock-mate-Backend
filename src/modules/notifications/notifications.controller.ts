import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { DeviceTokensService } from './device-tokens/device-tokens.service';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-request.interface';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

@Controller('notifications')
export class NotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly deviceTokensService: DeviceTokensService,
    ) {}

    @Get()
    async findAll(
        @Query() query: ListNotificationsDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.notificationsService.list(query, user.sub);
        return { message: 'Success', data };
    }

    @Get('unread-count')
    async unreadCount(@CurrentUser() user: AuthenticatedUser) {
        const data = await this.notificationsService.unreadCount(user.sub);
        return { message: 'Success', data };
    }

    @Patch(':id/read')
    async markRead(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.notificationsService.markRead(id, user.sub);
        return { message: 'Notification marked as read.', data };
    }

    @Patch('read-all')
    async markAllRead(@CurrentUser() user: AuthenticatedUser) {
        await this.notificationsService.markAllRead(user.sub);
        return { message: 'All notifications marked as read.', data: null };
    }

    @Post('device-tokens')
    async registerDeviceToken(
        @Body() dto: RegisterDeviceTokenDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.deviceTokensService.register(dto, user.sub);
        return { message: 'Device registered for push notifications.', data };
    }

    @Delete('device-tokens/:fcmToken')
    async unregisterDeviceToken(
        @Param('fcmToken') fcmToken: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        await this.deviceTokensService.unregister(fcmToken, user.sub);
        return { message: 'Device unregistered.', data: null };
    }
}
