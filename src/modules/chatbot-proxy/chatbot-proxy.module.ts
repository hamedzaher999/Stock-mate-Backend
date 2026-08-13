import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatbotProxyController } from './chatbot-proxy.controller';
import { ChatbotProxyService } from './chatbot-proxy.service';

@Module({
    imports: [HttpModule],
    controllers: [ChatbotProxyController],
    providers: [ChatbotProxyService],
})
export class ChatbotProxyModule {}
