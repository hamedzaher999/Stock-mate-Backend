import { Injectable } from '@nestjs/common';
import { DepartmentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CacheKeys } from '../../core/cache/cache-keys.constants';
import { CacheService } from '../../core/cache/cache.service';

export interface CachedDepartment {
    id: string;
    type: DepartmentType;
    isActive: boolean;
    tracksInventory: boolean;
    hasQueue: boolean;
}

const departmentSelect = {
    id: true,
    type: true,
    isActive: true,
    tracksInventory: true,
    hasQueue: true,
} satisfies Prisma.DepartmentSelect;

const DEPARTMENT_CACHE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class DepartmentsCacheService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}

    async getById(id: string): Promise<CachedDepartment | null> {
        const cacheKey = CacheKeys.department(id);
        const cached = await this.cacheService.get<CachedDepartment>(cacheKey);
        if (cached) return cached;

        const department = await this.prisma.department.findUnique({
            where: { id },
            select: departmentSelect,
        });
        if (!department) return null;

        await this.cacheService.set(
            cacheKey,
            department,
            DEPARTMENT_CACHE_TTL_MS,
        );
        return department;
    }

    async getByType(type: DepartmentType): Promise<CachedDepartment | null> {
        const cacheKey = CacheKeys.departmentByType(type);
        const cached = await this.cacheService.get<CachedDepartment>(cacheKey);
        if (cached) return cached;

        const department = await this.prisma.department.findFirst({
            where: { type },
            select: departmentSelect,
        });
        if (!department) return null;

        await this.cacheService.set(
            cacheKey,
            department,
            DEPARTMENT_CACHE_TTL_MS,
        );
        return department;
    }

    async invalidate(id: string, type: DepartmentType): Promise<void> {
        await Promise.all([
            this.cacheService.del(CacheKeys.department(id)),
            this.cacheService.del(CacheKeys.departmentByType(type)),
        ]);
    }
}
