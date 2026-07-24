import { Injectable } from '@nestjs/common';
import { Prisma, RequestStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { variantInventorySelect } from '../../../common/selects/variant.select';

const purchaseRequestDetailSelect = {
    id: true,
    requestNumber: true,
    requestedById: true,
    status: true,
    hospitalApprovedById: true,
    hospitalApprovedAt: true,
    hospitalRejectionReason: true,
    approvedById: true,
    approvedAt: true,
    rejectionReason: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
    requestedBy: { select: { id: true, fullName: true } },
    approvedBy: { select: { id: true, fullName: true } },
    items: {
        select: {
            id: true,
            variantId: true,
            requestedQuantity: true,
            estimatedPrice: true,
            approvedQuantity: true,
            receivedQuantity: true,
            quantityDiscrepancy: true,
            notes: true,
            variant: { select: variantInventorySelect },
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
        status?: RequestStatus;
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

    approveWithQuantities(
        id: string,
        approverId: string,
        items: { purchaseRequestItemId: string; approvedQuantity: number }[],
    ) {
        return this.prisma.$transaction(async (tx) => {
            for (const item of items) {
                await tx.purchaseRequestItem.update({
                    where: { id: item.purchaseRequestItemId },
                    data: {
                        approvedQuantity: item.approvedQuantity,
                        quantityDiscrepancy: item.approvedQuantity,
                    },
                });
            }
            return tx.purchaseRequest.update({
                where: { id },
                data: {
                    status: 'preparing',
                    approvedById: approverId,
                    approvedAt: new Date(),
                },
                select: purchaseRequestDetailSelect,
            });
        });
    }

    manualComplete(id: string) {
        return this.prisma.purchaseRequest.update({
            where: { id },
            data: { status: 'complete' },
            select: purchaseRequestDetailSelect,
        });
    }

    countReceiptsForRequest(id: string) {
        return this.prisma.purchaseReceipt.count({
            where: { purchaseRequestId: id },
        });
    }

    countUnconfirmedReceiptsForRequest(id: string) {
        return this.prisma.purchaseReceipt.count({
            where: { purchaseRequestId: id, status: 'pending_confirmation' },
        });
    }
}
