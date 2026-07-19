import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma, QueueStatus } from '@prisma/client';

const queueEntrySelect = {
    id: true,
    departmentId: true,
    department: { select: { id: true, name: true } },
    patientId: true,
    patient: {
        select: {
            id: true,
            fullName: true,
            nationalId: true,
            patientId: true,
            familyBookNumber: true,
        },
    },
    status: true,
    addedById: true,
    addedBy: { select: { id: true, fullName: true } },
    addedAt: true,
    lockedById: true,
    lockedBy: { select: { id: true, fullName: true } },
    lockedAt: true,
    completedAt: true,
    removedById: true,
    removedReason: true,
} satisfies Prisma.DepartmentQueueSelect;

const LIVE_STATUSES: QueueStatus[] = ['waiting', 'in_consultation'];

@Injectable()
export class DepartmentQueueRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findMany(params: {
        skip: number;
        take: number;
        departmentId: string;
        status?: QueueStatus;
        search?: string;
    }) {
        const where: Prisma.DepartmentQueueWhereInput = {
            departmentId: params.departmentId,
            status: params.status ?? { in: LIVE_STATUSES },
            ...(params.search && {
                patient: {
                    OR: [
                        {
                            fullName: {
                                contains: params.search,
                                mode: 'insensitive',
                            },
                        },
                        {
                            nationalId: {
                                contains: params.search,
                                mode: 'insensitive',
                            },
                        },
                        {
                            familyBookNumber: {
                                contains: params.search,
                                mode: 'insensitive',
                            },
                        },
                        {
                            patientId: {
                                contains: params.search,
                                mode: 'insensitive',
                            },
                        },
                    ],
                },
            }),
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.departmentQueue.findMany({
                where,
                select: queueEntrySelect,
                skip: params.skip,
                take: params.take,
                orderBy: { addedAt: 'asc' },
            }),
            this.prisma.departmentQueue.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.departmentQueue.findUnique({
            where: { id },
            select: queueEntrySelect,
        });
    }

    findRequestingUserContext(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: { departmentId: true, role: { select: { name: true } } },
        });
    }

    patientExists(id: string) {
        return this.prisma.patient.findUnique({
            where: { id },
            select: { id: true },
        });
    }

    findDepartmentType(id: string) {
        return this.prisma.department.findUnique({
            where: { id },
            select: { id: true, type: true, isActive: true },
        });
    }

    findActiveEntryForPatientInDepartment(
        patientId: string,
        departmentId: string,
    ) {
        return this.prisma.departmentQueue.findFirst({
            where: { patientId, departmentId, status: { in: LIVE_STATUSES } },
            select: { id: true },
        });
    }

    create(data: {
        departmentId: string;
        patientId: string;
        addedById: string;
    }) {
        return this.prisma.departmentQueue.create({
            data,
            select: queueEntrySelect,
        });
    }

    lock(id: string, lockedById: string) {
        return this.prisma.departmentQueue.update({
            where: { id },
            data: {
                status: 'in_consultation',
                lockedById,
                lockedAt: new Date(),
            },
            select: queueEntrySelect,
        });
    }

    release(id: string) {
        return this.prisma.departmentQueue.update({
            where: { id },
            data: { status: 'waiting', lockedById: null, lockedAt: null },
            select: queueEntrySelect,
        });
    }

    remove(id: string, removedById: string, removedReason: string) {
        return this.prisma.departmentQueue.update({
            where: { id },
            data: { status: 'removed', removedById, removedReason },
            select: queueEntrySelect,
        });
    }

    complete(id: string) {
        return this.prisma.departmentQueue.update({
            where: { id },
            data: { status: 'completed', completedAt: new Date() },
            select: queueEntrySelect,
        });
    }
}
