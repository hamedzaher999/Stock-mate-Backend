import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { OtpChannel } from '@prisma/client';

@Injectable()
export class OtpRepository {
    constructor(private readonly prisma: PrismaService) {}

    create(data: {
        userId: string;
        channel: OtpChannel;
        destination: string;
        codeHash: string;
        expiresAt: Date;
    }) {
        return this.prisma.otpCode.create({
            data: {
                userId: data.userId,
                channel: data.channel,
                destination: data.destination,
                code: data.codeHash,
                expiresAt: data.expiresAt,
            },
        });
    }

    async findMostRecentForUser(userId: string) {
        return this.prisma.otpCode.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    findActiveForUser(userId: string) {
        return this.prisma.otpCode.findFirst({
            where: { userId, consumed: false, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'desc' },
        });
    }

    incrementAttempts(id: string) {
        return this.prisma.otpCode.update({
            where: { id },
            data: { attempts: { increment: 1 } },
        });
    }

    markConsumed(id: string) {
        return this.prisma.otpCode.update({
            where: { id },
            data: { consumed: true },
        });
    }

    invalidateActiveCodes(userId: string) {
        return this.prisma.otpCode.updateMany({
            where: { userId, consumed: false },
            data: { consumed: true },
        });
    }
}
