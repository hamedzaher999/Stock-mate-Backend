import { Body, Controller, Post } from '@nestjs/common';
import { ChatbotProxyService } from './chatbot-proxy.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-request.interface';
import { Throttle } from '@nestjs/throttler';

@Controller('assistant')
export class ChatbotProxyController {
    constructor(private readonly chatbotProxyService: ChatbotProxyService) {}

    @Post('message')
    @Throttle({ default: { limit: 15, ttl: 60000 } })
    async sendMessage(
        @Body() dto: SendMessageDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.chatbotProxyService.sendMessage(dto, user.sub);
        return { message: 'تم بنجاح', data };
    }
}
