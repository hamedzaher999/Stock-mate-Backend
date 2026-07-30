import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ExpirationMonitorRepository } from './expiration-monitor.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_TYPES } from '../../common/constants/notification-types.constants';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_WARNING_DAYS = 6;

@Injectable()
export class ExpirationMonitorService {
    private readonly logger = new Logger(ExpirationMonitorService.name);

    constructor(
        private readonly expirationMonitorRepository: ExpirationMonitorRepository,
        private readonly notificationsService: NotificationsService,
        private readonly configService: ConfigService,
    ) {}

    @Cron(process.env.EXPIRATION_CHECK_CRON ?? '0 8 * * *')
    async handleCron() {
        const result = await this.runCheck();
        this.logger.log(
            `Expiration check complete: ${result.notified} notified, ${result.alreadyNotified} already flagged today, ${result.skippedNoManager} skipped (no manager assigned).`,
        );
    }

    async runCheck(asOf: Date = new Date()): Promise<{
        notified: number;
        alreadyNotified: number;
        skippedNoManager: number;
    }> {
        const warningDays =
            this.configService.get<number>('EXPIRATION_WARNING_DAYS') ??
            DEFAULT_WARNING_DAYS;
        const cutoff = new Date(asOf.getTime() + warningDays * MS_PER_DAY);

        const rows =
            await this.expirationMonitorRepository.findExpiringBatchStocks(
                cutoff,
            );

        let notified = 0;
        let alreadyNotified = 0;
        let skippedNoManager = 0;

        const todayKey = asOf.toISOString().slice(0, 10);

        for (const row of rows) {
            if (!row.departmentManagerId) {
                this.logger.warn(
                    `Department "${row.departmentName}" has no manager assigned -- skipping expiration notification for batch ${row.batchNumber} (${row.sku}).`,
                );
                skippedNoManager++;
                continue;
            }

            const daysLeft = Math.floor(
                (row.expirationDate.getTime() - asOf.getTime()) / MS_PER_DAY,
            );
            const isExpired = daysLeft < 0;

            const dedupeKey = `${row.batchId}:${row.departmentId}:${todayKey}`;
            const alreadyFlagged =
                await this.notificationsService.wasAlreadyNotified(
                    NOTIFICATION_TYPES.BATCH_EXPIRATION_ALERT,
                    'dedupeKey',
                    dedupeKey,
                );
            if (alreadyFlagged) {
                alreadyNotified++;
                continue;
            }

            const title = isExpired ? 'Batch expired' : 'Batch expiring soon';
            const body = isExpired
                ? `${row.variantName} (${row.sku}), batch ${row.batchNumber} at ${row.departmentName} expired ${Math.abs(daysLeft)} day(s) ago. ${row.quantity} unit(s) still in stock.`
                : `${row.variantName} (${row.sku}), batch ${row.batchNumber} at ${row.departmentName} has ${daysLeft} day(s) left before expiring. ${row.quantity} unit(s) in stock.`;

            await this.notificationsService.create({
                userId: row.departmentManagerId,
                type: NOTIFICATION_TYPES.BATCH_EXPIRATION_ALERT,
                category: 'inventory',
                title,
                body,
                data: {
                    batchId: row.batchId,
                    variantId: row.variantId,
                    departmentId: row.departmentId,
                    daysLeft,
                    isExpired,
                    dedupeKey,
                },
            });
            notified++;
        }

        return { notified, alreadyNotified, skippedNoManager };
    }
}
