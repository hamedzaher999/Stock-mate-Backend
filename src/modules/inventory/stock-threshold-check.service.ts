import { Injectable, Logger } from '@nestjs/common';
import { StockSettingsRepository } from '../stock-settings/stock-settings.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_TYPES } from '../../common/constants/notification-types.constants';

@Injectable()
export class StockThresholdCheckService {
    private readonly logger = new Logger(StockThresholdCheckService.name);

    constructor(
        private readonly stockSettingsRepository: StockSettingsRepository,
        private readonly notificationsService: NotificationsService,
    ) {}
    async checkAndNotify(params: {
        variantId: string;
        departmentId: string;
    }): Promise<void> {
        try {
            const setting =
                await this.stockSettingsRepository.findByVariantAndDepartment(
                    params.variantId,
                    params.departmentId,
                );
            if (!setting || !setting.isActive) return;
            if (setting.minimumStock === null && setting.maximumStock === null)
                return;

            const quantities =
                await this.stockSettingsRepository.getLiveQuantities([
                    {
                        variantId: params.variantId,
                        departmentId: params.departmentId,
                    },
                ]);
            const key = `${params.variantId}:${params.departmentId}`;
            const currentQuantity = quantities.get(key) ?? 0;

            const isBelowMin =
                setting.minimumStock !== null &&
                currentQuantity < Number(setting.minimumStock);
            const isAboveMax =
                setting.maximumStock !== null &&
                currentQuantity > Number(setting.maximumStock);

            if (!isBelowMin && !isAboveMax) return;

            const managerId = setting.department.managerId;
            if (!managerId) {
                this.logger.warn(
                    `Department "${setting.department.name}" has no manager assigned -- skipping real-time threshold notification for variant ${setting.variant.sku}.`,
                );
                return;
            }

            const todayKey = new Date().toISOString().slice(0, 10);

            if (isBelowMin) {
                await this.notifyIfNotAlready({
                    type: NOTIFICATION_TYPES.STOCK_BELOW_MINIMUM,
                    dedupeKey: `${key}:minimum:${todayKey}`,
                    managerId,
                    title: 'المخزون أقل من الحد الأدنى',
                    body: `${setting.variant.variantName} (${setting.variant.sku}) في ${setting.department.name} عند ${currentQuantity}، وهو أقل من الحد الأدنى ${Number(setting.minimumStock)}.`,
                    data: {
                        variantId: params.variantId,
                        departmentId: params.departmentId,
                        currentQuantity,
                        threshold: Number(setting.minimumStock),
                        thresholdType: 'minimum',
                    },
                });
            }

            if (isAboveMax) {
                await this.notifyIfNotAlready({
                    type: NOTIFICATION_TYPES.STOCK_ABOVE_MAXIMUM,
                    dedupeKey: `${key}:maximum:${todayKey}`,
                    managerId,
                    title: 'المخزون أعلى من الحد الأقصى',
                    body: `${setting.variant.variantName} (${setting.variant.sku}) في ${setting.department.name} عند ${currentQuantity}، وهو أعلى من الحد الأقصى ${Number(setting.maximumStock)}.`,
                    data: {
                        variantId: params.variantId,
                        departmentId: params.departmentId,
                        currentQuantity,
                        threshold: Number(setting.maximumStock),
                        thresholdType: 'maximum',
                    },
                });
            }
        } catch (error) {
            this.logger.warn(
                `Real-time stock threshold check failed for variant=${params.variantId} department=${params.departmentId}.`,
                error as Error,
            );
        }
    }

    async checkAndNotifyMany(
        pairs: { variantId: string; departmentId: string }[],
    ): Promise<void> {
        const unique = Array.from(
            new Map(
                pairs.map((p) => [`${p.variantId}:${p.departmentId}`, p]),
            ).values(),
        );
        await Promise.all(unique.map((p) => this.checkAndNotify(p)));
    }

    private async notifyIfNotAlready(params: {
        type: string;
        dedupeKey: string;
        managerId: string;
        title: string;
        body: string;
        data: Record<string, unknown>;
    }) {
        const alreadyFlagged =
            await this.notificationsService.wasAlreadyNotified(
                params.type,
                'dedupeKey',
                params.dedupeKey,
            );
        if (alreadyFlagged) return;

        await this.notificationsService.create({
            userId: params.managerId,
            type: params.type,
            category: 'inventory',
            title: params.title,
            body: params.body,
            data: { ...params.data, dedupeKey: params.dedupeKey },
        });
    }
}
