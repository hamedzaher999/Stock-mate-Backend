import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { SessionPlatform } from '@prisma/client';

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    userId: string;
    platform: SessionPlatform;
    accessTokenHash: string;
    refreshTokenHash: string;
    deviceInfo?: string;
    ipAddress?: string;
    accessExpiresAt: Date;
    refreshExpiresAt: Date;
  }) {
    return this.prisma.session.create({ data });
  }

  findActiveByRefreshTokenHash(refreshTokenHash: string) {
    return this.prisma.session.findFirst({
      where: {
        refreshTokenHash,
        revokedAt: null,
        refreshExpiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            roleId: true,
          },
        },
      },
    });
  }

  rotateTokens(
    id: string,
    data: {
      accessTokenHash: string;
      refreshTokenHash: string;
      accessExpiresAt: Date;
      refreshExpiresAt: Date;
    },
  ) {
    return this.prisma.session.update({ where: { id }, data });
  }

  revoke(id: string) {
    return this.prisma.session.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllForUser(userId: string) {
    return this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
