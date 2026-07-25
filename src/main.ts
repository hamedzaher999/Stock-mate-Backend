import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableShutdownHooks();
    app.use(helmet());

    app.use(cookieParser());
    const corsOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',')
        : [];
    app.enableCors({
        origin: corsOrigins,
        credentials: true,
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );
    app.setGlobalPrefix('api');

    const port = Number(process.env.PORT) || 3000;
    await app.listen(port);
}

bootstrap().catch((err) => {
    console.error('Failed to start application:', err);
    process.exit(1);
});
