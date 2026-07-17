import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      return await this.cache.get<T>(key);
    } catch (error) {
      this.logger.warn(
        `Cache GET failed for key "${key}" -- falling back to source of truth.`,
        error as Error,
      );
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttlMs);
    } catch (error) {
      this.logger.warn(
        `Cache SET failed for key "${key}" -- continuing without caching this value.`,
        error as Error,
      );
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cache.del(key);
    } catch (error) {
      this.logger.warn(`Cache DEL failed for key "${key}".`, error as Error);
    }
  }
}
