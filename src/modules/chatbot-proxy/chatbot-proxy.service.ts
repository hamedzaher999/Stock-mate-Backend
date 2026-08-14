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

export interface ChatbotReply {
    answer: string;
    hadContext: boolean;
}

@Injectable()
export class ChatbotProxyService {
    private readonly logger = new Logger(ChatbotProxyService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {}

    async sendMessage(
        dto: SendMessageDto,
        requestingUserId: string,
    ): Promise<ChatbotReply> {
        const baseUrl = this.configService.get<string>('chatbot.serviceUrl');
        const secret = this.configService.get<string>('chatbot.internalSecret');

        try {
            const response = await firstValueFrom(
                this.httpService.post<ChatbotReply>(
                    `${baseUrl}/internal/chat/message`,
                    {
                        message: dto.message,
                        history: dto.history,
                        userId: requestingUserId,
                    },
                    {
                        headers: { 'x-internal-secret': secret },
                        timeout: 20_000,
                    },
                ),
            );
            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;

            if (
                axiosError.code === 'ECONNREFUSED' ||
                axiosError.code === 'ETIMEDOUT'
            ) {
                this.logger.error(
                    'Chatbot service is unreachable.',
                    axiosError.stack,
                );

                throw new ServiceUnavailableException(
                    'The assistant is temporarily unavailable. Please try again shortly.',
                );
            }

            this.logger.error(
                `Chatbot service returned an error: ${
                    axiosError.message
                } | status=${axiosError.response?.status} | data=${JSON.stringify(
                    axiosError.response?.data,
                )}`,
                axiosError.stack,
            );

            throw new BadGatewayException(
                'The assistant could not process this request.',
            );
        }
    }
}
