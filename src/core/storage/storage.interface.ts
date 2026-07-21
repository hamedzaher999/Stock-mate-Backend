export interface UploadedImage {
    publicId: string;
}

export interface UploadImageOptions {
    folder?: string;
    publicId?: string;
}

export interface SignedUrlOptions {
    /** How long the generated URL should remain valid for. Default: 300 (5 minutes). */
    expiresInSeconds?: number;
}

export interface SignedUrlResult {
    url: string;
    expiresAt: Date;
}

export interface IStorageService {
    uploadImage(
        file: Buffer,
        options?: UploadImageOptions,
    ): Promise<UploadedImage>;
    deleteImage(publicId: string): Promise<void>;
    getSignedUrl(publicId: string, options?: SignedUrlOptions): SignedUrlResult;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
