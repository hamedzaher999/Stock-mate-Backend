import { Injectable } from '@nestjs/common';
import { Prisma, PeriodicScheduleStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';

const scheduleDetailSelect = {
    id: true,
    departmentId: true,
    createdById: true,
    originRequestId: true,
    status: true,
    approvalPolicy: true,
    requestType: true,
    frequencyInterval: true,
    hospitalApprovedById: true,
    hospitalApprovedAt: true,
    nextRunDate: true,
    lastGeneratedAt: true,
    cancelledById: true,
    cancelledAt: true,
    cancelReason: true,
    createdAt: true,
    updatedAt: true,
    department: { select: { id: true, name: true } },
    createdBy: { select: { id: true, fullName: true } },
    originRequest: {
        select: { id: true, requestNumber: true, priority: true },
    },
} satisfies Prisma.PeriodicRefillScheduleSelect;

@Injectable()
export class PeriodicSchedulesRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findMany(params: {
        skip: number;
        take: number;
        departmentId?: string;
        status?: PeriodicScheduleStatus;
    }) {
        const where: Prisma.PeriodicRefillScheduleWhereInput = {
            departmentId: params.departmentId,
            status: params.status,
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.periodicRefillSchedule.findMany({
                where,
                select: scheduleDetailSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.periodicRefillSchedule.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.periodicRefillSchedule.findUnique({
            where: { id },
            select: scheduleDetailSelect,
        });
    }

    findRequestingUserContext(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: { departmentId: true, role: { select: { name: true } } },
        });
    }

    cancel(params: { id: string; reason: string; cancelledById: string }) {
        return this.prisma.periodicRefillSchedule.update({
            where: { id: params.id },
            data: {
                status: 'cancelled',
                cancelledById: params.cancelledById,
                cancelledAt: new Date(),
                cancelReason: params.reason,
            },
            select: scheduleDetailSelect,
        });
    }

    findDueSchedules(asOf: Date) {
        return this.prisma.periodicRefillSchedule.findMany({
            where: { status: 'active', nextRunDate: { lte: asOf } },
            select: {
                id: true,
                departmentId: true,
                createdById: true,
                approvalPolicy: true,
                requestType: true,
                frequencyInterval: true,
                hospitalApprovedById: true,
                nextRunDate: true,
                department: { select: { type: true } },
                originRequest: {
                    select: {
                        priority: true,
                        items: {
                            select: {
                                variantId: true,
                                requestedQuantity: true,
                            },
                        },
                    },
                },
            },
        });
    }
}
