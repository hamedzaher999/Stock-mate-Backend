import { Injectable, Logger } from '@nestjs/common';
import { DepartmentQueueRepository } from './department-queue.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NOTIFICATION_TYPES } from '../../common/constants/notification-types.constants';

const MS_PER_HOUR = 60 * 60 * 1000;

@Injectable()
export class QueueWaitSchedulerService {
    private readonly logger = new Logger(QueueWaitSchedulerService.name);

    constructor(
        private readonly departmentQueueRepository: DepartmentQueueRepository,
        private readonly notificationsService: NotificationsService,
        private readonly configService: ConfigService,
    ) {}

    @Cron(process.env.QUEUE_WAIT_CHECK_CRON ?? '*/30 * * * *')
    async handleCron() {
        const result = await this.runCheck();
        this.logger.log(
            `Queue wait-time check complete: ${result.notified} entry(ies) notified, ${result.alreadyNotified} already flagged.`,
        );
    }

    async runCheck(): Promise<{ notified: number; alreadyNotified: number }> {
        const thresholdHours =
            this.configService.get<number>('QUEUE_WAIT_THRESHOLD_HOURS') ?? 5;
        const cutoff = new Date(Date.now() - thresholdHours * MS_PER_HOUR);

        const entries =
            await this.departmentQueueRepository.findWaitingEntriesOlderThan(
                cutoff,
            );

        let notified = 0;
        let alreadyNotified = 0;

        for (const entry of entries) {
            const alreadyFlagged =
                await this.notificationsService.wasAlreadyNotified(
                    NOTIFICATION_TYPES.QUEUE_WAIT_EXCEEDED,
                    'queueEntryId',
                    entry.id,
                );

            if (alreadyFlagged) {
                alreadyNotified++;
                continue;
            }

            const waitedHours = Math.floor(
                (Date.now() - entry.addedAt.getTime()) / MS_PER_HOUR,
            );

            await this.notificationsService.create({
                userId: entry.addedById,
                type: NOTIFICATION_TYPES.QUEUE_WAIT_EXCEEDED,
                category: 'queue',
                title: 'Patient waiting too long',
                body: `${entry.patient.fullName} has been waiting in the ${entry.department.name} queue for over ${waitedHours} hour(s).`,
                data: {
                    queueEntryId: entry.id,
                    departmentId: entry.departmentId,
                    patientId: entry.patient.id,
                    waitedHours,
                },
            });
            notified++;
        }

        return { notified, alreadyNotified };
    }
}
