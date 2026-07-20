import * as Joi from 'joi';

export const validationSchema = Joi.object({
    DATABASE_URL: Joi.string().required(),
    JWT_ACCESS_SECRET: Joi.string().min(16).required(),
    JWT_REFRESH_SECRET: Joi.string().min(16).required(),
    CORS_ORIGIN: Joi.string().optional(),
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),
    PORT: Joi.number().default(3000),
    OTP_LENGTH: Joi.number().valid(6, 8).default(8),
    EMAIL_HOST: Joi.string().required(),
    EMAIL_PORT: Joi.number().required(),
    EMAIL_USER: Joi.string().required(),
    EMAIL_PASS: Joi.string().required(),
    EMAIL_FROM: Joi.string().required(),
    RESEND_API_KEY: Joi.string().optional(),
    STOCK_THRESHOLD_CRON: Joi.string().default('0 7 * * *'),
    QUEUE_WAIT_CHECK_CRON: Joi.string().default('*/30 * * * *'),
    QUEUE_WAIT_THRESHOLD_HOURS: Joi.number().default(5),
    PRESCRIPTION_CYCLE_CHECK_CRON: Joi.string().default('0 0 * * *'),
    FIREBASE_PROJECT_ID: Joi.string().required(),
    FIREBASE_CLIENT_EMAIL: Joi.string().required(),
    FIREBASE_PRIVATE_KEY: Joi.string().required(),
});
