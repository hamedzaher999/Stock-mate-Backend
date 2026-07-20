import { NotificationCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

const notificationSelect = {
    id: true,
    type: true,
    category: true,
    title: true,
    body: true,
    data: true,
    isRead: true,
    readAt: true,
    createdAt: true,
} satisfies Prisma.NotificationSelect;

@Injectable()
export class NotificationsRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findMany(params: {
        userId: string;
        skip: number;
        take: number;
        isRead?: boolean;
        category?: NotificationCategory;
    }) {
        const where: Prisma.NotificationWhereInput = {
            userId: params.userId,
            isRead: params.isRead,
            category: params.category,
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.notification.findMany({
                where,
                select: notificationSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.notification.count({ where }),
        ]);

        return { items, total };
    }

    countUnread(userId: string) {
        return this.prisma.notification.count({
            where: { userId, isRead: false },
        });
    }

    create(data: {
        userId: string;
        type: string;
        category: NotificationCategory;
        title: string;
        body: string;
        data?: Prisma.InputJsonValue;
    }) {
        return this.prisma.notification.create({
            data,
            select: notificationSelect,
        });
    }

    findOwned(id: string, userId: string) {
        return this.prisma.notification.findFirst({
            where: { id, userId },
            select: { id: true },
        });
    }

    markRead(id: string) {
        return this.prisma.notification.update({
            where: { id },
            data: { isRead: true, readAt: new Date() },
            select: notificationSelect,
        });
    }

    markAllRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
    }

    existsForEntity(type: string, entityKey: string, entityId: string) {
        return this.prisma.notification.findFirst({
            where: {
                type,
                data: { path: [entityKey], equals: entityId },
            },
            select: { id: true },
        });
    }
}
