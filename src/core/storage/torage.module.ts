import { Global, Module } from '@nestjs/common';
import { STORAGE_SERVICE } from './storage.interface';
import { CloudinaryStorageService } from './cloudinary/cloudinary-storage.service';

@Global()
@Module({
    providers: [
        {
            provide: STORAGE_SERVICE,
            useClass: CloudinaryStorageService,
        },
    ],
    exports: [STORAGE_SERVICE],
})
export class StorageModule {}
