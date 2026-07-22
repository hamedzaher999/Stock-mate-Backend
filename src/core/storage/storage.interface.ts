export interface UploadedImage {
    key: string;
}

export interface UploadImageOptions {
    folder?: string;
    contentType?: string;
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
    deleteImage(key: string): Promise<void>;
    getSignedUrl(key: string): Promise<SignedUrlResult> | SignedUrlResult;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
