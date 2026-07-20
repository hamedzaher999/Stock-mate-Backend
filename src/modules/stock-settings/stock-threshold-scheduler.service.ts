import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { StockSettingsRepository } from './stock-settings.repository';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NOTIFICATION_TYPES } from '../../common/constants/notification-types.constants';

@Injectable()
export class StockThresholdSchedulerService {
    private readonly logger = new Logger(StockThresholdSchedulerService.name);

    constructor(
        private readonly stockSettingsRepository: StockSettingsRepository,
        private readonly notificationsService: NotificationsService,
        private readonly configService: ConfigService,
    ) {}

    @Cron(process.env.STOCK_THRESHOLD_CRON ?? '0 7 * * *')
    async handleCron() {
        const result = await this.runCheck();
        this.logger.log(
            `Stock threshold check complete: ${result.breaches} breach(es) notified, ${result.skippedNoManager} skipped (no manager assigned).`,
        );
    }

    async runCheck(): Promise<{ breaches: number; skippedNoManager: number }> {
        const settings =
            await this.stockSettingsRepository.findActiveThresholdSettings();

        const quantities = await this.stockSettingsRepository.getLiveQuantities(
            settings.map((s) => ({
                variantId: s.variantId,
                departmentId: s.departmentId,
            })),
        );

        let breaches = 0;
        let skippedNoManager = 0;

        for (const setting of settings) {
            const key = `${setting.variantId}:${setting.departmentId}`;
            const currentQuantity = quantities.get(key) ?? 0;

            const isBelowMin =
                setting.minimumStock !== null &&
                currentQuantity < Number(setting.minimumStock);
            const isAboveMax =
                setting.maximumStock !== null &&
                currentQuantity > Number(setting.maximumStock);

            if (!isBelowMin && !isAboveMax) continue;

            if (!setting.department.managerId) {
                this.logger.warn(
                    `Department "${setting.department.name}" has no manager assigned -- skipping threshold notification for variant ${setting.variant.sku}.`,
                );
                skippedNoManager++;
                continue;
            }

            if (isBelowMin) {
                await this.notificationsService.create({
                    userId: setting.department.managerId,
                    type: NOTIFICATION_TYPES.STOCK_BELOW_MINIMUM,
                    category: 'inventory',
                    title: 'Stock below minimum',
                    body: `${setting.variant.variantName} (${setting.variant.sku}) at ${setting.department.name} is at ${currentQuantity}, below the minimum of ${Number(setting.minimumStock)}.`,
                    data: {
                        variantId: setting.variantId,
                        departmentId: setting.departmentId,
                        currentQuantity,
                        threshold: Number(setting.minimumStock),
                        thresholdType: 'minimum',
                    },
                });
                breaches++;
            }

            if (isAboveMax) {
                await this.notificationsService.create({
                    userId: setting.department.managerId,
                    type: NOTIFICATION_TYPES.STOCK_ABOVE_MAXIMUM,
                    category: 'inventory',
                    title: 'Stock above maximum',
                    body: `${setting.variant.variantName} (${setting.variant.sku}) at ${setting.department.name} is at ${currentQuantity}, above the maximum of ${Number(setting.maximumStock)}.`,
                    data: {
                        variantId: setting.variantId,
                        departmentId: setting.departmentId,
                        currentQuantity,
                        threshold: Number(setting.maximumStock),
                        thresholdType: 'maximum',
                    },
                });
                breaches++;
            }
        }

        return { breaches, skippedNoManager };
    }
}
