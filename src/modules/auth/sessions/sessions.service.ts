import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SessionsRepository } from './sessions.repository';
import { SessionPlatform } from '@prisma/client';
import { randomUUID } from 'crypto';
import { hashToken } from '../../../common/utils/token-hash.util';

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class SessionsService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly jwtService: JwtService,
  ) {}

  private signAccessToken(payload: {
    sub: string;
    sessionId: string;
    roleId: string;
  }) {
    return this.jwtService.sign(payload, {
      expiresIn: '15m',
      secret: process.env.JWT_ACCESS_SECRET as string,
    });
  }

  private signRefreshToken(payload: { sub: string; sessionId: string }) {
    return this.jwtService.sign(payload, {
      expiresIn: '30d',
      secret: process.env.JWT_REFRESH_SECRET as string,
    });
  }

  async createSession(params: {
    userId: string;
    roleId: string;
    platform: SessionPlatform;
    deviceInfo?: string;
    ipAddress?: string;
  }) {
    const sessionId = randomUUID();
    const accessToken = this.signAccessToken({
      sub: params.userId,
      sessionId,
      roleId: params.roleId,
    });
    const refreshToken = this.signRefreshToken({
      sub: params.userId,
      sessionId,
    });

    const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.sessionsRepository.create({
      userId: params.userId,
      platform: params.platform,
      accessTokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(refreshToken),
      deviceInfo: params.deviceInfo,
      ipAddress: params.ipAddress,
      accessExpiresAt,
      refreshExpiresAt,
    });

    return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt };
  }

  async refreshSession(refreshToken: string) {
    const session = await this.sessionsRepository.findActiveByRefreshTokenHash(
      hashToken(refreshToken),
    );
    if (!session) return null;

    try {
      this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET as string,
      });
    } catch {
      return null;
    }

    const accessToken = this.signAccessToken({
      sub: session.userId,
      sessionId: session.id,
      roleId: session.user.roleId,
    });
    const newRefreshToken = this.signRefreshToken({
      sub: session.userId,
      sessionId: session.id,
    });
    const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.sessionsRepository.rotateTokens(session.id, {
      accessTokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(newRefreshToken),
      accessExpiresAt,
      refreshExpiresAt,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      accessExpiresAt,
      refreshExpiresAt,
      user: session.user,
    };
  }

  revokeSession(sessionId: string) {
    return this.sessionsRepository.revoke(sessionId);
  }

  revokeAllForUser(userId: string) {
    return this.sessionsRepository.revokeAllForUser(userId);
  }
}
