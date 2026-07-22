import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { FirebaseAdminService } from '../../../core/firebase/firebase-admin.service';

@Injectable()
export class PushService implements OnModuleInit {
    private readonly logger = new Logger(PushService.name);
    private messaging!: Messaging;

    constructor(private readonly firebaseAdminService: FirebaseAdminService) {}

    onModuleInit() {
        this.messaging = getMessaging(this.firebaseAdminService.getApp());
    }

    async sendToTokens(
        tokens: string[],
        payload: { title: string; body: string; data?: Record<string, string> },
    ): Promise<string[]> {
        if (tokens.length === 0) return [];

        const invalidTokens: string[] = [];

        try {
            const response = await this.messaging.sendEachForMulticast({
                tokens,
                notification: { title: payload.title, body: payload.body },
                data: payload.data,
            });

            response.responses.forEach((res, i) => {
                if (!res.success) {
                    const code = res.error?.code;
                    if (
                        code === 'messaging/invalid-registration-token' ||
                        code === 'messaging/registration-token-not-registered'
                    ) {
                        invalidTokens.push(tokens[i]);
                    } else {
                        this.logger.warn(
                            `Push failed for token ${tokens[i]}: ${res.error?.message}`,
                        );
                    }
                }
            });
        } catch (error) {
            this.logger.warn('Push send failed entirely.', error as Error);
        }

        return invalidTokens;
    }
}
