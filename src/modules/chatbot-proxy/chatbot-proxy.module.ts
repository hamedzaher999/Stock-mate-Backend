import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatbotProxyController } from './chatbot-proxy.controller';
import { ChatbotProxyService } from './chatbot-proxy.service';
import { RbacModule } from '../rbac/rbac.module';
@Module({
    imports: [HttpModule, RbacModule],
    controllers: [ChatbotProxyController],
    providers: [ChatbotProxyService],
})
export class ChatbotProxyModule {}
