import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { CacheKeys } from '../../core/cache/cache-keys.constants';

export interface UserScope {
    departmentId: string | null;
    roleName: string;
}

const USER_SCOPE_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class UserScopeService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}

    async getUserScope(userId: string): Promise<UserScope | null> {
        const cacheKey = CacheKeys.userScope(userId);
        const cached = await this.cacheService.get<UserScope>(cacheKey);
        if (cached) return cached;

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { departmentId: true, role: { select: { name: true } } },
        });
        if (!user) return null;

        const scope: UserScope = {
            departmentId: user.departmentId,
            roleName: user.role.name,
        };

        await this.cacheService.set(cacheKey, scope, USER_SCOPE_CACHE_TTL_MS);
        return scope;
    }

    invalidate(userId: string): Promise<void> {
        return this.cacheService.del(CacheKeys.userScope(userId));
    }
}
