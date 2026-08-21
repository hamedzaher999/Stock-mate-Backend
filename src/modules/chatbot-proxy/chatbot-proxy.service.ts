import {
    BadGatewayException,
    Injectable,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { SendMessageDto } from './dto/send-message.dto';
import { UserScopeService } from '../rbac/user-scope.service';
export interface ChatbotReply {
    answer: string;
    hadContext: boolean;
}

const MAX_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class ChatbotProxyService {
    private readonly logger = new Logger(ChatbotProxyService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly userScopeService: UserScopeService,
    ) {}

    async sendMessage(
        dto: SendMessageDto,
        requestingUserId: string,
    ): Promise<ChatbotReply> {
        const baseUrl = this.configService.get<string>('chatbot.serviceUrl');
        const secret = this.configService.get<string>('chatbot.internalSecret');

        const scope =
            await this.userScopeService.getUserScope(requestingUserId);
        const role = scope?.roleName;

        let lastError: AxiosError | undefined;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await firstValueFrom(
                    this.httpService.post<ChatbotReply>(
                        `${baseUrl}/internal/chat/message`,
                        {
                            message: `${dto.message}\n\n[تعليمات: يجب أن تكون إجابتك باللغة العربية فقط.]`,
                            history: dto.history,
                            userId: requestingUserId,
                            platform: dto.platform,
                            role,
                        },
                        {
                            headers: { 'x-internal-secret': secret },
                            timeout: 45_000,
                        },
                    ),
                );
                return response.data;
            } catch (error) {
                const axiosError = error as AxiosError;
                lastError = axiosError;

                const status = axiosError.response?.status;
                const isConnectionIssue =
                    axiosError.code === 'ECONNREFUSED' ||
                    axiosError.code === 'ETIMEDOUT' ||
                    axiosError.code === 'ECONNABORTED';
                const isRetryableStatus =
                    status !== undefined && RETRYABLE_STATUS_CODES.has(status);
                const canRetry =
                    (isConnectionIssue || isRetryableStatus) &&
                    attempt < MAX_RETRIES;

                this.logger.error(
                    `Chatbot service call failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}) ` +
                        `code=${axiosError.code} status=${status} ` +
                        `message=${axiosError.message} ` +
                        `data=${JSON.stringify(axiosError.response?.data)} ` +
                        `user=${requestingUserId}`,
                    axiosError.stack,
                );

                if (canRetry) {
                    const backoffMs = 500 * Math.pow(2, attempt);
                    await sleep(backoffMs);
                    continue;
                }

                break;
            }
        }

        const axiosError = lastError!;
        const status = axiosError.response?.status;

        if (
            axiosError.code === 'ECONNREFUSED' ||
            axiosError.code === 'ETIMEDOUT' ||
            axiosError.code === 'ECONNABORTED'
        ) {
            throw new ServiceUnavailableException(
                `المساعد غير متاح مؤقتاً (${axiosError.code}). يرجى المحاولة مرة أخرى بعد قليل.`,
            );
        }

        const downstreamData = axiosError.response?.data as
            { message?: string; error?: string } | undefined;
        const downstreamMessage =
            downstreamData?.message ??
            downstreamData?.error ??
            axiosError.message;

        throw new BadGatewayException(
            `لم يتمكن المساعد من معالجة هذا الطلب. ` +
                `[الحالة=${status ?? 'غير متاح'}] ${downstreamMessage}`,
        );
    }
}
