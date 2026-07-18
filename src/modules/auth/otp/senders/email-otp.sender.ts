import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { OtpSender, OtpSenderResult } from './otp-sender.interface';

@Injectable()
export class EmailOtpSender implements OtpSender {
    private readonly logger = new Logger(EmailOtpSender.name);
    private readonly transporter: Transporter;
    private readonly fromAddress: string;

    constructor(private readonly configService: ConfigService) {
        this.transporter = createTransport({
            host: this.configService.get<string>('EMAIL_HOST'),
            port: this.configService.get<number>('EMAIL_PORT'),
            secure: this.configService.get<number>('EMAIL_PORT') === 465,
            auth: {
                user: this.configService.get<string>('EMAIL_USER'),
                pass: this.configService.get<string>('EMAIL_PASS'),
            },
        });
        this.fromAddress = this.configService.get<string>(
            'EMAIL_FROM',
        ) as string;
    }

    async send(destination: string, code: string): Promise<OtpSenderResult> {
        this.transporter
            .verify()
            .then(() => console.log('SMTP OK'))
            .catch((err) => console.error('SMTP ERROR', err));

        try {
            const info = await this.transporter.sendMail({
                from: this.fromAddress,
                to: destination,
                subject: 'Your Red Crescent verification code',
                text: `Your verification code is: ${code}. It expires in 5 minutes.`,
            });
            return {
                success: true,
                providerMessageId: info.messageId as string,
            };
        } catch (error) {
            this.logger.error(
                `Failed to send OTP email to ${destination}`,
                error as Error,
            );
            return { success: false };
        }
    }
}
