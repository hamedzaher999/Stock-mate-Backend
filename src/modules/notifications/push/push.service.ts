import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

@Injectable()
export class PushService implements OnModuleInit {
    private readonly logger = new Logger(PushService.name);
    private app!: App;
    private messaging!: Messaging;

    constructor(private readonly configService: ConfigService) {}

    onModuleInit() {
        this.app = initializeApp({
            credential: cert({
                projectId: this.configService.get<string>(
                    'FIREBASE_PROJECT_ID',
                ),
                clientEmail: this.configService.get<string>(
                    'FIREBASE_CLIENT_EMAIL',
                ),
                privateKey: (
                    this.configService.get<string>('FIREBASE_PRIVATE_KEY') ?? ''
                ).replace(/\\n/g, '\n'),
            }),
        });

        this.messaging = getMessaging(this.app);
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
