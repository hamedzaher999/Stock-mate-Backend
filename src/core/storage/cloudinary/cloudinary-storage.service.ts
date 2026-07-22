import { Readable } from 'stream';
import {
    BadRequestException,
    Injectable,
    Logger,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import {
    IStorageService,
    SignedUrlResult,
    UploadedImage,
    UploadImageOptions,
} from '../storage.interface';

const TOKEN_AUTH_DURATION_SECONDS = 300;
const PLAIN_SIGNED_RECOMMENDED_REFETCH_SECONDS = 300;

@Injectable()
export class CloudinaryStorageService implements IStorageService, OnModuleInit {
    private readonly logger = new Logger(CloudinaryStorageService.name);
    private authTokenKey: string | undefined;

    constructor(private readonly configService: ConfigService) {}

    onModuleInit() {
        cloudinary.config({
            cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
            api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
            api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
            secure: true,
        });

        const configuredKey = this.configService.get<string>(
            'CLOUDINARY_AUTH_TOKEN_KEY',
        );
        this.authTokenKey = configuredKey?.trim() ? configuredKey : undefined;

        this.logger.log(
            this.authTokenKey
                ? 'Cloudinary token-based authentication is ENABLED -- image URLs will have real, enforced expiry.'
                : 'Cloudinary token-based authentication is not configured -- falling back to plain signed URLs (advisory expiry only). Set CLOUDINARY_AUTH_TOKEN_KEY once subscribed to enable real expiry.',
        );
    }

    uploadImage(
        file: Buffer,
        options?: UploadImageOptions,
    ): Promise<UploadedImage> {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: options?.folder ?? 'red-crescent',
                    resource_type: 'image',
                    type: 'authenticated',
                    overwrite: false,
                },
                (error, result) => {
                    if (error || !result) {
                        this.logger.error(
                            'Cloudinary upload failed.',
                            error as Error,
                        );
                        reject(
                            new BadRequestException(
                                'Failed to upload the receipt image. Please try again.',
                            ),
                        );
                        return;
                    }
                    resolve({ key: result.public_id });
                },
            );

            Readable.from(file).pipe(uploadStream);
        });
    }

    async deleteImage(key: string): Promise<void> {
        try {
            await cloudinary.uploader.destroy(key, {
                resource_type: 'image',
                type: 'authenticated',
            });
        } catch (error) {
            this.logger.warn(
                `Failed to delete Cloudinary image "${key}".`,
                error as Error,
            );
        }
    }

    getSignedUrl(key: string): SignedUrlResult {
        if (this.authTokenKey) {
            return this.getTokenAuthenticatedUrl(key);
        }
        return this.getPlainSignedUrl(key);
    }

    private getTokenAuthenticatedUrl(key: string): SignedUrlResult {
        const url = cloudinary.url(key, {
            resource_type: 'image',
            type: 'authenticated',
            secure: true,
            sign_url: true,
            auth_token: {
                key: this.authTokenKey,
                duration: TOKEN_AUTH_DURATION_SECONDS,
            },
        });

        return {
            url,
            expiresAt: new Date(
                Date.now() + TOKEN_AUTH_DURATION_SECONDS * 1000,
            ),
        };
    }

    private getPlainSignedUrl(key: string): SignedUrlResult {
        const url = cloudinary.url(key, {
            resource_type: 'image',
            type: 'authenticated',
            secure: true,
            sign_url: true,
        });

        return {
            url,
            expiresAt: new Date(
                Date.now() + PLAIN_SIGNED_RECOMMENDED_REFETCH_SECONDS * 1000,
            ),
        };
    }
}
