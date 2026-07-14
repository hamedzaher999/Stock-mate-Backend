import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { OtpSender, OtpSenderResult } from './otp-sender.interface';

@Injectable()
export class EmailOtpSender implements OtpSender {
  private readonly logger = new Logger(EmailOtpSender.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    this.fromAddress = this.configService.get<string>('EMAIL_FROM') as string;
  }

  async send(destination: string, code: string): Promise<OtpSenderResult> {
    const { data, error } = await this.resend.emails.send({
      from: this.fromAddress,
      to: destination,
      subject: 'Your Red Crescent verification code',
      text: `Your verification code is: ${code}. It expires in 5 minutes.`,
    });

    if (error) {
      this.logger.error(
        `Failed to send OTP email to ${destination}: ${error.message}`,
      );
      return { success: false };
    }

    return { success: true, providerMessageId: data?.id };
  }
}
