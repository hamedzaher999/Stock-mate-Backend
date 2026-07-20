import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DeviceTokensRepository } from './device-tokens/device-tokens.repository';
import { NotificationsRepository } from './notifications.repository';
import { PushService } from './push/push.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { PaginatedResult } from '../../core/interfaces/paginated-result.interface';
import { NotificationCategory, Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        private readonly notificationsRepository: NotificationsRepository,
        private readonly deviceTokensRepository: DeviceTokensRepository,
        private readonly pushService: PushService,
    ) {}

    async list(
        dto: ListNotificationsDto,
        userId: string,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } = await this.notificationsRepository.findMany({
            userId,
            skip: (page - 1) * limit,
            take: limit,
            isRead:
                dto.isRead === undefined ? undefined : dto.isRead === 'true',
            category: dto.category,
        });

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async unreadCount(userId: string) {
        return {
            count: await this.notificationsRepository.countUnread(userId),
        };
    }

    async markRead(id: string, userId: string) {
        const owned = await this.notificationsRepository.findOwned(id, userId);
        if (!owned) throw new NotFoundException('Notification not found.');
        return this.notificationsRepository.markRead(id);
    }

    markAllRead(userId: string) {
        return this.notificationsRepository.markAllRead(userId);
    }

    async create(params: {
        userId: string;
        type: string;
        category: NotificationCategory;
        title: string;
        body: string;
        data?: Record<string, unknown>;
    }) {
        const notification = await this.notificationsRepository.create({
            userId: params.userId,
            type: params.type,
            category: params.category,
            title: params.title,
            body: params.body,
            data: params.data as Prisma.InputJsonValue,
        });

        this.pushToUser(params.userId, {
            title: params.title,
            body: params.body,
            data: { type: params.type, notificationId: notification.id },
        }).catch((error) =>
            this.logger.warn('Push dispatch failed.', error as Error),
        );

        return notification;
    }

    private async pushToUser(
        userId: string,
        payload: { title: string; body: string; data: Record<string, string> },
    ) {
        const devices = await this.deviceTokensRepository.findByUser(userId);
        if (devices.length === 0) return;

        const invalidTokens = await this.pushService.sendToTokens(
            devices.map((d) => d.fcmToken),
            payload,
        );

        for (const token of invalidTokens) {
            await this.deviceTokensRepository.deleteByToken(token);
        }
    }
    async wasAlreadyNotified(
        type: string,
        entityKey: string,
        entityId: string,
    ): Promise<boolean> {
        const existing = await this.notificationsRepository.existsForEntity(
            type,
            entityKey,
            entityId,
        );
        return existing !== null;
    }
}
