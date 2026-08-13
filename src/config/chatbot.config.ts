import { registerAs } from '@nestjs/config';

export default registerAs('chatbot', () => ({
    internalSecret: process.env.CHATBOT_INTERNAL_SECRET ?? '',
    serviceUrl: process.env.CHATBOT_SERVICE_URL ?? '',
}));
