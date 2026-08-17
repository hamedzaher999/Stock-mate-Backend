import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
    ExtractJwt,
    Strategy,
    StrategyOptionsWithoutRequest,
} from 'passport-jwt';
import type { Request } from 'express';
import { JwtPayload } from '../../../core/interfaces/jwt-payload.interface';
import { RequestWithCookies } from '../../../core/interfaces/request-with-cookies.interface';
import { SessionsRepository } from '../sessions/sessions.repository';
function cookieOrHeaderExtractor(req: Request): string | null {
    const cookies = (req as RequestWithCookies).cookies;
    const cookieToken = cookies?.access_token;

    if (typeof cookieToken === 'string' && cookieToken.length > 0) {
        return cookieToken;
    }

    return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

const strategyOptions: StrategyOptionsWithoutRequest = {
    jwtFromRequest: cookieOrHeaderExtractor,
    ignoreExpiration: false,
    secretOrKey: process.env.JWT_ACCESS_SECRET as string,
};

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
    Strategy,
    'jwt-access',
) {
    constructor(private readonly sessionsRepository: SessionsRepository) {
        super(strategyOptions);
    }

    async validate(payload: JwtPayload): Promise<JwtPayload> {
        const session = await this.sessionsRepository.findActiveById(
            payload.sessionId,
        );
        if (!session) {
            throw new UnauthorizedException(
                'الجلسة تم إنهاؤها أو انتهت صلاحيتها. يرجى تسجيل الدخول مرة أخرى.',
            );
        }

        return {
            sub: payload.sub,
            sessionId: payload.sessionId,
            roleId: payload.roleId,
        };
    }
}
