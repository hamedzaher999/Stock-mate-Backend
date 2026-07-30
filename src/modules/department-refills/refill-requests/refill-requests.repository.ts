import { Injectable } from '@nestjs/common';
import {
    Prisma,
    RefillRequestPriority,
    RefillRequestType,
    RequestStatus,
    ScheduleApprovalPolicy,
} from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { variantInventorySelect } from '../../../common/selects/variant.select';
import {
    computeCycleEnd,
    requestTypeToFrequencyUnit,
} from '../../../common/utils/recurrence.util';
import { AlreadyProcessedError } from '../../../common/utils/concurrency.util';

const refillRequestDetailSelect = {
    id: true,
    requestNumber: true,
    departmentId: true,
    department: { select: { id: true, name: true, type: true } },
    requestedById: true,
    requestedBy: { select: { id: true, fullName: true } },
    status: true,
    priority: true,
    requestType: true,
    frequencyInterval: true,
    periodicScheduleId: true,
    hospitalApprovedById: true,
    hospitalApprovedAt: true,
    hospitalRejectionReason: true,
    approvedById: true,
    approvedAt: true,
    rejectionReason: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
    items: {
        select: {
            id: true,
            variantId: true,
            requestedQuantity: true,
            approvedQuantity: true,
            deliveredQuantity: true,
            quantityDiscrepancy: true,
            variant: { select: variantInventorySelect },
            deliveryItems: {
                select: {
                    id: true,
                    deliveryId: true,
                    batchId: true,
                    shippedQuantity: true,
                    receivedQuantity: true,
                    quantityDiscrepancy: true,
                    batch: {
                        select: {
                            id: true,
                            batchNumber: true,
                            expirationDate: true,
                        },
                    },
                },
            },
        },
    },
} satisfies Prisma.DepartmentRefillRequestSelect;

const refillRequestListSelect = {
    id: true,
    requestNumber: true,
    departmentId: true,
    department: { select: { id: true, name: true } },
    status: true,
    priority: true,
    requestType: true,
    periodicScheduleId: true,
    createdAt: true,
} satisfies Prisma.DepartmentRefillRequestSelect;

@Injectable()
export class RefillRequestsRepository {
    constructor(private readonly prisma: PrismaService) {}

    findItemById(id: string) {
        return this.prisma.departmentRefillItem.findUnique({
            where: { id },
            select: {
                id: true,
                refillRequestId: true,
                variantId: true,
                requestedQuantity: true,
                approvedQuantity: true,
                deliveredQuantity: true,
                quantityDiscrepancy: true,
                variant: { select: { id: true, variantName: true, sku: true } },
                deliveryItems: {
                    select: {
                        id: true,
                        deliveryId: true,
                        batchId: true,
                        shippedQuantity: true,
                        receivedQuantity: true,
                        quantityDiscrepancy: true,
                        batch: {
                            select: {
                                id: true,
                                batchNumber: true,
                                expirationDate: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async findMany(params: {
        skip: number;
        take: number;
        status?: RequestStatus;
        departmentId?: string;
        priority?: RefillRequestPriority;
        requestType?: RefillRequestType;
    }) {
        const where: Prisma.DepartmentRefillRequestWhereInput = {
            status: params.status,
            departmentId: params.departmentId,
            priority: params.priority,
            requestType: params.requestType,
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.departmentRefillRequest.findMany({
                where,
                select: refillRequestListSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.departmentRefillRequest.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.departmentRefillRequest.findUnique({
            where: { id },
            select: refillRequestDetailSelect,
        });
    }

    findVariantsWithActivation(ids: string[]) {
        return this.prisma.productVariant.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                isActive: true,
                product: { select: { isActive: true } },
            },
        });
    }

    create(data: {
        requestNumber: string;
        departmentId: string;
        requestedById: string;
        priority: 'normal' | 'urgent';
        requestType: 'normal' | 'daily' | 'weekly' | 'monthly';
        frequencyInterval?: number;
        notes?: string;
        items: { variantId: string; requestedQuantity: number }[];
    }) {
        return this.prisma.departmentRefillRequest.create({
            data: {
                requestNumber: data.requestNumber,
                departmentId: data.departmentId,
                requestedById: data.requestedById,
                priority: data.priority,
                requestType: data.requestType,
                frequencyInterval: data.frequencyInterval,
                notes: data.notes,
                items: { create: data.items },
            },
            select: refillRequestDetailSelect,
        });
    }

    async replaceItems(
        id: string,
        notes: string | undefined,
        items?: { variantId: string; requestedQuantity: number }[],
    ) {
        return this.prisma.$transaction(async (tx) => {
            if (items) {
                await tx.departmentRefillItem.deleteMany({
                    where: { refillRequestId: id },
                });
                await tx.departmentRefillItem.createMany({
                    data: items.map((item) => ({
                        ...item,
                        refillRequestId: id,
                    })),
                });
            }
            return tx.departmentRefillRequest.update({
                where: { id },
                data: { notes },
                select: refillRequestDetailSelect,
            });
        });
    }

    async updateStatus(
        id: string,
        expectedStatus: RequestStatus,
        data: Prisma.DepartmentRefillRequestUncheckedUpdateInput,
    ) {
        const claimed = await this.prisma.departmentRefillRequest.updateMany({
            where: { id, status: expectedStatus },
            data,
        });
        if (claimed.count === 0) {
            throw new AlreadyProcessedError(
                'This refill request was already updated by another request.',
            );
        }
        return this.prisma.departmentRefillRequest.findUniqueOrThrow({
            where: { id },
            select: refillRequestDetailSelect,
        });
    }

    approveWithQuantities(
        id: string,
        approverId: string,
        items: { refillItemId: string; approvedQuantity: number }[],
        newScheduleApprovalPolicy?: ScheduleApprovalPolicy,
    ) {
        return this.prisma.$transaction(async (tx) => {
            const approvedAt = new Date();

            const claimed = await tx.departmentRefillRequest.updateMany({
                where: { id, status: 'pending_manager_approval' },
                data: {
                    status: 'preparing',
                    approvedById: approverId,
                    approvedAt,
                },
            });
            if (claimed.count === 0) {
                throw new AlreadyProcessedError(
                    'This refill request was already updated by another request.',
                );
            }

            for (const item of items) {
                await tx.departmentRefillItem.update({
                    where: { id: item.refillItemId },
                    data: {
                        approvedQuantity: item.approvedQuantity,
                        quantityDiscrepancy: item.approvedQuantity,
                    },
                });
            }

            if (newScheduleApprovalPolicy) {
                const request =
                    await tx.departmentRefillRequest.findUniqueOrThrow({
                        where: { id },
                        select: {
                            departmentId: true,
                            requestedById: true,
                            requestType: true,
                            frequencyInterval: true,
                        },
                    });

                const unit = requestTypeToFrequencyUnit(
                    request.requestType as 'daily' | 'weekly' | 'monthly',
                );
                const nextRunDate = computeCycleEnd(
                    approvedAt,
                    unit,
                    request.frequencyInterval,
                );

                const schedule = await tx.periodicRefillSchedule.create({
                    data: {
                        departmentId: request.departmentId,
                        createdById: request.requestedById,
                        originRequestId: id,
                        approvalPolicy: newScheduleApprovalPolicy,
                        requestType: request.requestType,
                        frequencyInterval: request.frequencyInterval as number,
                        approvedById: approverId,
                        approvedAt,
                        nextRunDate,
                    },
                });

                await tx.departmentRefillRequest.update({
                    where: { id },
                    data: { periodicScheduleId: schedule.id },
                });
            }

            return tx.departmentRefillRequest.findUniqueOrThrow({
                where: { id },
                select: refillRequestDetailSelect,
            });
        });
    }

    async manualComplete(id: string) {
        const claimed = await this.prisma.departmentRefillRequest.updateMany({
            where: { id, status: 'partially_complete' },
            data: { status: 'complete' },
        });
        if (claimed.count === 0) {
            throw new AlreadyProcessedError(
                'This refill request was already updated by another request.',
            );
        }
        return this.prisma.departmentRefillRequest.findUniqueOrThrow({
            where: { id },
            select: refillRequestDetailSelect,
        });
    }

    countDeliveriesForRequest(id: string) {
        return this.prisma.departmentRefillDelivery.count({
            where: { refillRequestId: id },
        });
    }

    countUnconfirmedDeliveriesForRequest(id: string) {
        return this.prisma.departmentRefillDelivery.count({
            where: { refillRequestId: id, confirmedAt: null },
        });
    }
}
