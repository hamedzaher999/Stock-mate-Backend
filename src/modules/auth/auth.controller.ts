import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Public } from '../../core/decorators/public.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { SessionPlatform } from '@prisma/client';
import type { RequestWithCookies } from '../../core/interfaces/request-with-cookies.interface';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-request.interface';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 600000 } })
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto) {
    const result = await this.authService.requestOtp(dto);
    return { message: result.message, data: result.data };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(dto, {
      deviceInfo: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    if (dto.platform === SessionPlatform.web) {
      this.setAuthCookies(res, result);
      return {
        message: 'Logged in successfully.',
        data: { user: result.user },
      };
    }

    return {
      message: 'Logged in successfully.',
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessExpiresAt: result.accessExpiresAt,
        refreshExpiresAt: result.refreshExpiresAt,
      },
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyToken?: string,
  ) {
    const cookieToken = req.cookies?.[REFRESH_COOKIE];
    const refreshToken = cookieToken ?? bodyToken;

    if (!refreshToken) {
      return { message: 'No refresh token provided.', data: null };
    }

    const result = await this.authService.refresh(refreshToken);

    if (cookieToken) {
      this.setAuthCookies(res, result);
      return { message: 'Session refreshed.', data: { user: result.user } };
    }

    return {
      message: 'Session refreshed.',
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessExpiresAt: result.accessExpiresAt,
        refreshExpiresAt: result.refreshExpiresAt,
      },
    };
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.authService.me(user.sub);
    return { message: 'Success', data };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.sessionId);
    res.clearCookie(ACCESS_COOKIE);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth/refresh' });
    return { message: 'Logged out.', data: null };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAll(user.sub);
    res.clearCookie(ACCESS_COOKIE);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth/refresh' });
    return { message: 'Logged out from all devices.', data: null };
  }

  private setAuthCookies(
    res: Response,
    tokens: {
      accessToken: string;
      refreshToken: string;
      accessExpiresAt: Date;
      refreshExpiresAt: Date;
    },
  ) {
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie(ACCESS_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      expires: tokens.accessExpiresAt,
      path: '/',
    });

    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      expires: tokens.refreshExpiresAt,
      path: '/api/auth/refresh',
    });
  }
}
