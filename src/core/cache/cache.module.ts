import { Global, Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { CacheService } from './cache.service';
@Global()
@Module({
    imports: [
        NestCacheModule.register({
            isGlobal: true,
            ttl: 5 * 60 * 1000,
            max: 1500,
        }),
    ],
    providers: [CacheService],
    exports: [CacheService],
})
export class CacheModule {}
