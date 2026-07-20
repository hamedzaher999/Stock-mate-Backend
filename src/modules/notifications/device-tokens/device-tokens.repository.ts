import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { SessionPlatform } from '@prisma/client';

@Injectable()
export class DeviceTokensRepository {
    constructor(private readonly prisma: PrismaService) {}

    upsert(data: {
        userId: string;
        platform: SessionPlatform;
        fcmToken: string;
    }) {
        return this.prisma.deviceToken.upsert({
            where: { fcmToken: data.fcmToken },
            update: { userId: data.userId, lastSeenAt: new Date() },
            create: data,
        });
    }

    findByUser(userId: string) {
        return this.prisma.deviceToken.findMany({
            where: { userId },
            select: { id: true, fcmToken: true },
        });
    }

    deleteByToken(fcmToken: string) {
        return this.prisma.deviceToken.deleteMany({ where: { fcmToken } });
    }

    deleteForUserByToken(userId: string, fcmToken: string) {
        return this.prisma.deviceToken.deleteMany({
            where: { userId, fcmToken },
        });
    }
}
