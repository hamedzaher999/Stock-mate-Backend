import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiResponse } from '../interfaces/api-response.interface';
import { Prisma } from '@prisma/client';
const PRISMA_ERROR_MAP: Record<
    string,
    { status: HttpStatus; message: (meta: unknown) => string }
> = {
    P2002: {
        status: HttpStatus.CONFLICT,
        message: () =>
            'يوجد سجل بهذه البيانات مسبقاً. يرجى التحقق من المدخلات.',
    },
    P2003: {
        status: HttpStatus.CONFLICT,
        message: () =>
            'لا يمكن حذف أو تعديل هذا السجل لوجود بيانات أخرى تعتمد عليه.',
    },
    P2025: {
        status: HttpStatus.NOT_FOUND,
        message: () => 'البيانات المطلوبة غير موجودة.',
    },
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        const { status, message } = this.resolve(exception);

        if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(
                'Unhandled exception reached the global filter.',
                exception instanceof Error
                    ? exception.stack
                    : String(exception),
            );
        }

        const body: ApiResponse<null> = {
            success: false,
            message,
            data: null,
        };
        response.status(status).json(body);
    }

    private resolve(exception: unknown): {
        status: HttpStatus;
        message: string;
    } {
        if (exception instanceof HttpException) {
            return {
                status: exception.getStatus(),
                message: this.extractMessage(exception),
            };
        }

        if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            const mapped = PRISMA_ERROR_MAP[exception.code];
            if (mapped) {
                return {
                    status: mapped.status,
                    message: mapped.message(exception.meta),
                };
            }
        }

        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'حدث خطأ في الخادم. يرجى المحاولة لاحقاً.',
        };
    }

    private extractMessage(exception: HttpException): string {
        const response = exception.getResponse();
        if (typeof response === 'string') return response;
        if (
            typeof response === 'object' &&
            response !== null &&
            'message' in response
        ) {
            const msg = (response as { message: string | string[] }).message;
            return Array.isArray(msg) ? msg.join(', ') : msg;
        }
        return exception.message;
    }
}
