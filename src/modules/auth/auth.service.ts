import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthRepository } from './auth.repository';
import { OtpService } from './otp/otp.service';
import { SessionsService } from './sessions/sessions.service';
import { PermissionsResolverService } from '../rbac/permissions-resolver.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpChannel } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly otpService: OtpService,
    private readonly sessionsService: SessionsService,
    private readonly permissionsResolver: PermissionsResolverService,
  ) {}

  async requestOtp(dto: RequestOtpDto) {
    const user = await this.authRepository.findUserByIdentifier({
      phone: dto.phone,
      email: dto.email,
    });
    if (!user || user.status !== 'active') {
      return { message: 'If this account exists, an OTP has been sent.' };
    }

    const channel = this.resolveChannel(dto);
    const destination = channel === OtpChannel.email ? user.email : user.phone;

    if (!destination) {
      throw new BadRequestException(
        'No destination available for the selected channel.',
      );
    }

    await this.otpService.issueOtp(user.id, channel, destination);
    return { message: 'If this account exists, an OTP has been sent.' };
  }

  async verifyOtp(
    dto: VerifyOtpDto,
    context: { deviceInfo?: string; ipAddress?: string },
  ) {
    const user = await this.authRepository.findUserByIdentifier({
      phone: dto.phone,
      email: dto.email,
    });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isValid = await this.otpService.verifyOtp(user.id, dto.code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired code.');
    }

    const session = await this.sessionsService.createSession({
      userId: user.id,
      roleId: user.roleId,
      platform: dto.platform,
      deviceInfo: context.deviceInfo,
      ipAddress: context.ipAddress,
    });

    const userPayload = await this.buildUserPayload(user.id);
    return { user: userPayload, ...session };
  }

  async refresh(refreshToken: string) {
    const result = await this.sessionsService.refreshSession(refreshToken);
    if (!result) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const userPayload = await this.buildUserPayload(result.user.id);
    return { ...result, user: userPayload };
  }

  async me(userId: string) {
    return this.buildUserPayload(userId);
  }

  logout(sessionId: string) {
    return this.sessionsService.revokeSession(sessionId);
  }

  logoutAll(userId: string) {
    return this.sessionsService.revokeAllForUser(userId);
  }

  private resolveChannel(dto: RequestOtpDto): OtpChannel {
    if (dto.channel) return dto.channel;
    return dto.email ? OtpChannel.email : OtpChannel.phone;
  }

  private async buildUserPayload(userId: string) {
    const user = await this.authRepository.findUserWithRoleById(userId);
    if (!user) throw new UnauthorizedException('Account not found.');

    const permissionsSet =
      await this.permissionsResolver.getEffectivePermissions(userId);

    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      specialty: user.specialty,
      status: user.status,
      role: user.role,
      department: user.department,
      permissions: Array.from(permissionsSet),
    };
  }
}
