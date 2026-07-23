import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { CacheKeys } from '../../core/cache/cache-keys.constants';

export interface CachedUnit {
    id: string;
    name: string;
    abbreviation: string | null;
    createdAt: Date;
}

export interface CachedCategory {
    id: string;
    name: string;
    parentCategoryId: string | null;
    createdAt: Date;
    parentCategory: { id: string; name: string } | null;
}

const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class CatalogCacheService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}

    async getUnits(): Promise<CachedUnit[]> {
        const cacheKey = CacheKeys.unitsList();
        const cached = await this.cacheService.get<CachedUnit[]>(cacheKey);
        if (cached) return cached;

        const units = await this.prisma.unit.findMany({
            orderBy: { name: 'asc' },
        });

        await this.cacheService.set(cacheKey, units, CATALOG_CACHE_TTL_MS);
        return units;
    }

    async getCategories(): Promise<CachedCategory[]> {
        const cacheKey = CacheKeys.categoriesList();
        const cached = await this.cacheService.get<CachedCategory[]>(cacheKey);
        if (cached) return cached;

        const categories = await this.prisma.category.findMany({
            include: { parentCategory: { select: { id: true, name: true } } },
            orderBy: { name: 'asc' },
        });

        await this.cacheService.set(cacheKey, categories, CATALOG_CACHE_TTL_MS);
        return categories;
    }

    invalidateUnits(): Promise<void> {
        return this.cacheService.del(CacheKeys.unitsList());
    }

    invalidateCategories(): Promise<void> {
        return this.cacheService.del(CacheKeys.categoriesList());
    }
}
