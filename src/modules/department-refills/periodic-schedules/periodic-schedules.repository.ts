import { Injectable } from '@nestjs/common';
import { Prisma, PeriodicScheduleStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../../common/constants/roles.constants';
import { AlreadyProcessedError } from '../../../common/utils/concurrency.util';

const scheduleDetailSelect = {
    id: true,
    departmentId: true,
    createdById: true,
    originRequestId: true,
    status: true,
    approvalPolicy: true,
    requestType: true,
    frequencyInterval: true,
    approvedById: true,
    approvedAt: true,
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
    async cancel(params: {
        id: string;
        reason: string;
        cancelledById: string;
    }) {
        const claimed = await this.prisma.periodicRefillSchedule.updateMany({
            where: { id: params.id, status: 'active' },
            data: {
                status: 'cancelled',
                cancelledById: params.cancelledById,
                cancelledAt: new Date(),
                cancelReason: params.reason,
            },
        });
        if (claimed.count === 0) {
            throw new AlreadyProcessedError(
                'This schedule was already cancelled by another request.',
            );
        }
        return this.prisma.periodicRefillSchedule.findUniqueOrThrow({
            where: { id: params.id },
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
                approvedById: true,
                nextRunDate: true,
                department: { select: { type: true } },
                originRequest: {
                    select: {
                        priority: true,
                        items: {
                            select: { variantId: true, approvedQuantity: true },
                        },
                    },
                },
            },
        });
    }

    findCentralWarehouseManagerId() {
        return this.prisma.department.findFirst({
            where: { type: 'central_warehouse' },
            select: { managerId: true },
        });
    }

    findHospitalManagerId() {
        return this.prisma.user.findFirst({
            where: {
                role: { name: HOSPITAL_MANAGER_ROLE_NAME },
                status: 'active',
            },
            select: { id: true },
        });
    }
}
