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
    SignedUrlOptions,
    SignedUrlResult,
    UploadedImage,
    UploadImageOptions,
} from '../storage.interface';

const DEFAULT_EXPIRY_SECONDS = 300;

@Injectable()
export class CloudinaryStorageService implements IStorageService, OnModuleInit {
    private readonly logger = new Logger(CloudinaryStorageService.name);
    private authTokenKey!: string;

    constructor(private readonly configService: ConfigService) {}

    onModuleInit() {
        cloudinary.config({
            cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
            api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
            api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
            secure: true,
        });

        this.authTokenKey = this.configService.get<string>(
            'CLOUDINARY_AUTH_TOKEN_KEY',
        ) as string;
    }

    uploadImage(
        file: Buffer,
        options?: UploadImageOptions,
    ): Promise<UploadedImage> {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: options?.folder ?? 'red-crescent',
                    public_id: options?.publicId,
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
                    resolve({ publicId: result.public_id });
                },
            );

            Readable.from(file).pipe(uploadStream);
        });
    }

    async deleteImage(publicId: string): Promise<void> {
        try {
            await cloudinary.uploader.destroy(publicId, {
                resource_type: 'image',
                type: 'authenticated',
            });
        } catch (error) {
            this.logger.warn(
                `Failed to delete Cloudinary image "${publicId}".`,
                error as Error,
            );
        }
    }

    getSignedUrl(
        publicId: string,
        options?: SignedUrlOptions,
    ): SignedUrlResult {
        const expiresInSeconds =
            options?.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS;

        const url = cloudinary.url(publicId, {
            resource_type: 'image',
            type: 'authenticated',
            secure: true,
            sign_url: true,
            auth_token: {
                key: this.authTokenKey,
                duration: expiresInSeconds,
            },
        });

        return {
            url,
            expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
        };
    }
}
