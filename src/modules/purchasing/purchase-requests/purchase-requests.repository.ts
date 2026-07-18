import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { Prisma, PurchaseRequestStatus } from '@prisma/client';

const purchaseRequestDetailSelect = {
    id: true,
    requestNumber: true,
    requestedById: true,
    status: true,
    hospitalApprovedById: true,
    hospitalApprovedAt: true,
    hospitalRejectionReason: true,
    committeeApprovedById: true,
    committeeApprovedAt: true,
    committeeRejectionReason: true,
    committeeMarkedReadyById: true,
    committeeMarkedReadyAt: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
    requestedBy: { select: { id: true, fullName: true } },
    items: {
        select: {
            id: true,
            variantId: true,
            requestedQuantity: true,
            estimatedPrice: true,
            committeeApprovedQuantity: true,
            receivedQuantity: true,
            notes: true,
            variant: { select: { id: true, variantName: true, sku: true } },
        },
    },
} satisfies Prisma.PurchaseRequestSelect;

const purchaseRequestListSelect = {
    id: true,
    requestNumber: true,
    status: true,
    requestedBy: { select: { id: true, fullName: true } },
    createdAt: true,
} satisfies Prisma.PurchaseRequestSelect;

@Injectable()
export class PurchaseRequestsRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findMany(params: {
        skip: number;
        take: number;
        status?: PurchaseRequestStatus;
        requestedById?: string;
    }) {
        const where: Prisma.PurchaseRequestWhereInput = {
            status: params.status,
            requestedById: params.requestedById,
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.purchaseRequest.findMany({
                where,
                select: purchaseRequestListSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.purchaseRequest.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.purchaseRequest.findUnique({
            where: { id },
            select: purchaseRequestDetailSelect,
        });
    }

    variantsExist(ids: string[]) {
        return this.prisma.productVariant.findMany({
            where: { id: { in: ids } },
            select: { id: true },
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
    findRequestingUserRole(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: { select: { name: true } } },
        });
    }

    create(data: {
        requestNumber: string;
        requestedById: string;
        notes?: string;
        items: {
            variantId: string;
            requestedQuantity: number;
            estimatedPrice?: number;
            notes?: string;
        }[];
    }) {
        return this.prisma.purchaseRequest.create({
            data: {
                requestNumber: data.requestNumber,
                requestedById: data.requestedById,
                notes: data.notes,
                items: { create: data.items },
            },
            select: purchaseRequestDetailSelect,
        });
    }

    async replaceItems(
        id: string,
        notes: string | undefined,
        items?: {
            variantId: string;
            requestedQuantity: number;
            estimatedPrice?: number;
            notes?: string;
        }[],
    ) {
        return this.prisma.$transaction(async (tx) => {
            if (items) {
                await tx.purchaseRequestItem.deleteMany({
                    where: { purchaseRequestId: id },
                });
                await tx.purchaseRequestItem.createMany({
                    data: items.map((item) => ({
                        ...item,
                        purchaseRequestId: id,
                    })),
                });
            }
            return tx.purchaseRequest.update({
                where: { id },
                data: { notes },
                select: purchaseRequestDetailSelect,
            });
        });
    }

    updateStatus(id: string, data: Prisma.PurchaseRequestUncheckedUpdateInput) {
        return this.prisma.purchaseRequest.update({
            where: { id },
            data,
            select: purchaseRequestDetailSelect,
        });
    }

    setCommitteeApprovedQuantities(
        purchaseRequestId: string,
        approvals: {
            purchaseRequestItemId: string;
            approvedQuantity: number;
        }[],
        approverId: string,
    ) {
        return this.prisma.$transaction(async (tx) => {
            for (const approval of approvals) {
                await tx.purchaseRequestItem.update({
                    where: { id: approval.purchaseRequestItemId },
                    data: {
                        committeeApprovedQuantity: approval.approvedQuantity,
                    },
                });
            }
            return tx.purchaseRequest.update({
                where: { id: purchaseRequestId },
                data: {
                    status: 'approved',
                    committeeApprovedById: approverId,
                    committeeApprovedAt: new Date(),
                },
                select: purchaseRequestDetailSelect,
            });
        });
    }
}
