import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { OtpService } from './otp/otp.service';
import { OtpRepository } from './otp/otp.repository';
import { EmailOtpSender } from './otp/senders/email-otp.sender';
import { SmsOtpSender } from './otp/senders/sms-otp.sender';
import { SessionsService } from './sessions/sessions.service';
import { SessionsRepository } from './sessions/sessions.repository';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [PassportModule, JwtModule.register({}), RbacModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    OtpService,
    OtpRepository,
    EmailOtpSender,
    SmsOtpSender,
    SessionsService,
    SessionsRepository,
    JwtAccessStrategy,
  ],
  exports: [SessionsService],
})
export class AuthModule {}
