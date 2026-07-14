import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { CacheKeys } from '../../core/cache/cache-keys.constants';

const PERMISSIONS_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class PermissionsResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async getEffectivePermissions(userId: string): Promise<Set<string>> {
    const cacheKey = CacheKeys.effectivePermissions(userId);
    const cached = await this.cacheService.get<string[]>(cacheKey);
    if (cached) return new Set(cached);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: {
          select: {
            rolePermissions: {
              select: { permission: { select: { code: true } } },
            },
          },
        },
        userPermissions: {
          select: { effect: true, permission: { select: { code: true } } },
        },
      },
    });

    if (!user) return new Set();

    const effective = new Set<string>(
      user.role.rolePermissions.map((rp) => rp.permission.code),
    );

    for (const override of user.userPermissions) {
      if (override.effect === 'grant') {
        effective.add(override.permission.code);
      } else {
        effective.delete(override.permission.code);
      }
    }

    await this.cacheService.set(
      cacheKey,
      Array.from(effective),
      PERMISSIONS_CACHE_TTL_MS,
    );
    return effective;
  }

  invalidate(userId: string): Promise<boolean> {
    return this.cacheService.del(CacheKeys.effectivePermissions(userId));
  }
}
