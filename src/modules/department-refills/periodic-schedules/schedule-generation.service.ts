import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PeriodicSchedulesRepository } from './periodic-schedules.repository';
import { generateRequestNumber } from '../../../common/utils/request-number-generator.util';
import {
    computeCycleEnd,
    requestTypeToFrequencyUnit,
} from '../../../common/utils/recurrence.util';
import { NotificationsService } from '../../notifications/notifications.service';
import { NOTIFICATION_TYPES } from '../../../common/constants/notification-types.constants';
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
            const requestId = await this.prisma.$transaction(async (tx) => {
                const isAutoApproved =
                    schedule.approvalPolicy === 'auto_approved';

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
                            ? 'approved'
                            : 'pending_hospital_approval',
                        hospitalApprovedById: isAutoApproved
                            ? schedule.hospitalApprovedById
                            : undefined,
                        hospitalApprovedAt: isAutoApproved
                            ? new Date()
                            : undefined,
                        items: {
                            create: schedule.originRequest.items.map((i) => ({
                                variantId: i.variantId,
                                requestedQuantity: i.requestedQuantity,
                            })),
                        },
                    },
                });

                const unit = requestTypeToFrequencyUnit(
                    schedule.requestType as 'daily' | 'weekly' | 'monthly',
                );
                const nextRunDate = computeCycleEnd(
                    schedule.nextRunDate,
                    unit,
                    schedule.frequencyInterval,
                );
                await tx.periodicRefillSchedule.update({
                    where: { id: schedule.id },
                    data: { nextRunDate, lastGeneratedAt: new Date() },
                });

                return request.id;
            });

            generated.push(requestId);
            this.logger.log(
                `Generated refill request ${requestId} from schedule ${schedule.id}`,
            );

            if (schedule.approvalPolicy === 'auto_approved') {
                await this.notificationsService.create({
                    userId: schedule.createdById,
                    type: NOTIFICATION_TYPES.PERIODIC_REFILL_GENERATED,
                    category: 'inventory',
                    title: 'Recurring refill generated',
                    body: `A new refill request was automatically generated and approved from your recurring schedule for ${schedule.department.type === 'central_warehouse' ? 'the Central Warehouse' : 'your department'}.`,
                    data: {
                        refillRequestId: requestId,
                        periodicScheduleId: schedule.id,
                        departmentId: schedule.departmentId,
                    },
                });
            } else {
                const hospitalManager =
                    await this.periodicSchedulesRepository.findHospitalManagerId();
                if (hospitalManager) {
                    await this.notificationsService.create({
                        userId: hospitalManager.id,
                        type: NOTIFICATION_TYPES.PERIODIC_REFILL_PENDING_APPROVAL,
                        category: 'inventory',
                        title: 'Recurring refill needs approval',
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
