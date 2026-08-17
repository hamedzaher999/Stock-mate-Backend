import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PeriodicSchedulesRepository } from './periodic-schedules.repository';
import { NotificationsService } from '../../notifications/notifications.service';
import { NOTIFICATION_TYPES } from '../../../common/constants/notification-types.constants';
import { generateRequestNumber } from '../../../common/utils/request-number-generator.util';
import {
    computeCycleEnd,
    requestTypeToFrequencyUnit,
} from '../../../common/utils/recurrence.util';

@Injectable()
export class ScheduleGenerationService {
    private readonly logger = new Logger(ScheduleGenerationService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly periodicSchedulesRepository: PeriodicSchedulesRepository,
        private readonly notificationsService: NotificationsService,
    ) {}

    @Cron('0 6 * * *')
    async handleCron() {
        const generated = await this.runDue();
        if (generated.length > 0) {
            this.logger.log(
                `Generated ${generated.length} refill request(s) from due schedules.`,
            );
        }
    }

    async runDue(asOf: Date = new Date()): Promise<string[]> {
        const due =
            await this.periodicSchedulesRepository.findDueSchedules(asOf);
        const generated: string[] = [];

        for (const schedule of due) {
            const isAutoApproved = schedule.approvalPolicy === 'auto_approved';

            const unit = requestTypeToFrequencyUnit(
                schedule.requestType as 'daily' | 'weekly' | 'monthly',
            );
            const nextRunDate = computeCycleEnd(
                schedule.nextRunDate,
                unit,
                schedule.frequencyInterval,
            );

            let requestId: string | null;
            try {
                requestId = await this.prisma.$transaction(async (tx) => {
                    const claimed = await tx.periodicRefillSchedule.updateMany({
                        where: {
                            id: schedule.id,
                            status: 'active',
                            nextRunDate: { lte: asOf },
                        },
                        data: { nextRunDate, lastGeneratedAt: new Date() },
                    });
                    if (claimed.count === 0) {
                        return null;
                    }

                    const request = await tx.departmentRefillRequest.create({
                        data: {
                            requestNumber: generateRequestNumber('DRF'),
                            departmentId: schedule.departmentId,
                            requestedById: schedule.createdById,
                            priority: schedule.originRequest.priority,
                            requestType: schedule.requestType,
                            frequencyInterval: schedule.frequencyInterval,
                            periodicScheduleId: schedule.id,
                            status: isAutoApproved
                                ? 'pending_manager_approval'
                                : 'pending_hospital_approval',
                            hospitalApprovedById: isAutoApproved
                                ? schedule.approvedById
                                : undefined,
                            hospitalApprovedAt: isAutoApproved
                                ? new Date()
                                : undefined,
                            items: {
                                create: schedule.originRequest.items.map(
                                    (i) => ({
                                        variantId: i.variantId,
                                        requestedQuantity: Number(
                                            i.approvedQuantity,
                                        ),
                                    }),
                                ),
                            },
                        },
                    });

                    return request.id;
                });
            } catch (error) {
                this.logger.error(
                    `Failed to generate refill request from schedule ${schedule.id} -- skipping and continuing with remaining schedules.`,
                    error instanceof Error ? error.stack : String(error),
                );
                continue;
            }

            if (!requestId) {
                continue;
            }

            generated.push(requestId);
            this.logger.log(
                `Generated refill request ${requestId} from schedule ${schedule.id}`,
            );

            await this.notificationsService.create({
                userId: schedule.createdById,
                type: NOTIFICATION_TYPES.PERIODIC_REFILL_GENERATED,
                category: 'inventory',
                title: 'تم إنشاء تزويد متكرر',
                body: 'تم إنشاء طلب تزويد جديد تلقائياً من جدولك المتكرر وهو في انتظار الموافقة.',
                data: {
                    refillRequestId: requestId,
                    periodicScheduleId: schedule.id,
                    departmentId: schedule.departmentId,
                },
            });

            if (isAutoApproved) {
                const warehouseManager =
                    await this.periodicSchedulesRepository.findCentralWarehouseManagerId();
                if (warehouseManager?.managerId) {
                    await this.notificationsService.create({
                        userId: warehouseManager.managerId,
                        type: NOTIFICATION_TYPES.PERIODIC_REFILL_PENDING_APPROVAL,
                        category: 'inventory',
                        title: 'التزويد المتكرر يحتاج إلى موافقة',
                        body: `A recurring refill request has been generated from schedule ${schedule.id} and is awaiting your approval.`,
                        data: {
                            refillRequestId: requestId,
                            periodicScheduleId: schedule.id,
                            departmentId: schedule.departmentId,
                        },
                    });
                } else {
                    this.logger.warn(
                        `No Central Warehouse manager assigned -- could not notify about pending-approval refill request ${requestId}.`,
                    );
                }
            } else {
                const hospitalManager =
                    await this.periodicSchedulesRepository.findHospitalManagerId();
                if (hospitalManager) {
                    await this.notificationsService.create({
                        userId: hospitalManager.id,
                        type: NOTIFICATION_TYPES.PERIODIC_REFILL_PENDING_APPROVAL,
                        category: 'inventory',
                        title: 'التزويد المتكرر يحتاج إلى موافقة',
                        body: `A recurring refill request has been generated from schedule ${schedule.id} and is awaiting your approval.`,
                        data: {
                            refillRequestId: requestId,
                            periodicScheduleId: schedule.id,
                            departmentId: schedule.departmentId,
                        },
                    });
                } else {
                    this.logger.warn(
                        `No active Hospital Manager found -- could not notify about pending-approval refill request ${requestId}.`,
                    );
                }
            }
        }

        return generated;
    }
}
