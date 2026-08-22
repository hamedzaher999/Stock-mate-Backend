import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { CacheService } from '../../../core/cache/cache.service';

const REPORT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const REPORT_CACHE_PREFIX = 'reports:';

export type ReportKind =
    'adjustments' | 'inventory-movement' | 'patient-visits';

@Injectable()
export class ReportsCacheService {
    private readonly issuedKeysByKind = new Map<ReportKind, Set<string>>();

    constructor(private readonly cacheService: CacheService) {}

    private buildKey(
        kind: ReportKind,
        operation: 'report' | 'export',
        requestingUserId: string,
        params: Record<string, unknown>,
    ): string {
        const normalized = Object.keys(params)
            .filter((k) => params[k] !== undefined && params[k] !== null)
            .sort()
            .map((k) => `${k}=${String(params[k])}`)
            .join('&');

        const hash = createHash('sha256')
            .update(normalized)
            .digest('hex')
            .slice(0, 32);

        return `${REPORT_CACHE_PREFIX}${kind}:${operation}:${requestingUserId}:${hash}`;
    }

    async getOrCompute<T>(
        kind: ReportKind,
        operation: 'report' | 'export',
        requestingUserId: string,
        params: Record<string, unknown>,
        compute: () => Promise<T>,
        ttlMs: number = REPORT_CACHE_TTL_MS,
    ): Promise<T> {
        const key = this.buildKey(kind, operation, requestingUserId, params);

        const cached = await this.cacheService.get<T>(key);
        if (cached !== undefined) return cached;

        const result = await compute();

        await this.cacheService.set(key, result, ttlMs);

        let keys = this.issuedKeysByKind.get(kind);
        if (!keys) {
            keys = new Set();
            this.issuedKeysByKind.set(kind, keys);
        }
        keys.add(key);

        return result;
    }

    /**
     * Clears every cached report/export result for a given report kind.
     * Call this after any write that changes the data a report depends on
     * (e.g. a new inventory adjustment -> invalidateKind('adjustments')).
     */
    async invalidateKind(kind: ReportKind): Promise<void> {
        const keys = this.issuedKeysByKind.get(kind);
        if (!keys || keys.size === 0) return;

        await Promise.all([...keys].map((key) => this.cacheService.del(key)));
        keys.clear();
    }
}
