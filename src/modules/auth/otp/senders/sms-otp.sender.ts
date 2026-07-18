import { Injectable, Logger } from '@nestjs/common';
import { OtpSender, OtpSenderResult } from './otp-sender.interface';

@Injectable()
export class SmsOtpSender implements OtpSender {
    private readonly logger = new Logger(SmsOtpSender.name);

    send(destination: string, code: string): Promise<OtpSenderResult> {
        this.logger.log(`[DEV SMS] OTP for ${destination}: ${code}`);
        return Promise.resolve({ success: true });
    }
}
