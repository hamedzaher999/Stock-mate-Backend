import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpRepository } from './otp.repository';
import { OtpChannel } from '@prisma/client';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { EmailOtpSender } from './senders/email-otp.sender';
import { SmsOtpSender } from './senders/sms-otp.sender';

const OTP_TTL_MINUTES = 5;
const SALT_ROUNDS = 10;
const MAX_VERIFY_ATTEMPTS = 3;
const RESEND_COOLDOWN_MS = 60 * 1000;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly codeLength: number;

  constructor(
    private readonly otpRepository: OtpRepository,
    private readonly emailSender: EmailOtpSender,
    private readonly smsSender: SmsOtpSender,
    private readonly configService: ConfigService,
  ) {
    this.codeLength = this.configService.get<number>('OTP_LENGTH') ?? 6;
  }

  private generateCode(): string {
    const max = 10 ** this.codeLength;
    const value = randomInt(0, max);
    return value.toString().padStart(this.codeLength, '0');
  }

  async issueOtp(userId: string, channel: OtpChannel, destination: string) {
    const lastOtp = await this.otpRepository.findMostRecentForUser(userId);

    if (lastOtp) {
      const elapsedMs = Date.now() - lastOtp.createdAt.getTime();
      if (elapsedMs < RESEND_COOLDOWN_MS) {
        const retryAfterSeconds = Math.ceil(
          (RESEND_COOLDOWN_MS - elapsedMs) / 1000,
        );
        throw new HttpException(
          `Please wait ${retryAfterSeconds}s before requesting another code.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    await this.otpRepository.invalidateActiveCodes(userId);

    const code = this.generateCode();
    console.log('----------------------------');
    console.log(code);
    console.log('----------------------------');

    const codeHash = await bcrypt.hash(code, SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.otpRepository.create({
      userId,
      channel,
      destination,
      codeHash,
      expiresAt,
    });

    // const sender =
    //   channel === OtpChannel.email ? this.emailSender : this.smsSender;
    // const result = await sender.send(destination, code);

    // if (!result.success) {
    //   this.logger.warn(`OTP delivery failed for ${destination} via ${channel}`);
    // }
    //  TODO:DELETE CODE FROM RESPONSE
    return { expiresAt, code };
  }

  async verifyOtp(userId: string, code: string): Promise<boolean> {
    const otp = await this.otpRepository.findActiveForUser(userId);
    if (!otp) return false;

    if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
      await this.otpRepository.markConsumed(otp.id);
      return false;
    }

    const isMatch = await bcrypt.compare(code, otp.code);
    if (!isMatch) {
      await this.otpRepository.incrementAttempts(otp.id);
      return false;
    }

    await this.otpRepository.markConsumed(otp.id);
    return true;
  }
}
