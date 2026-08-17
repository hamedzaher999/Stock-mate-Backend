import { Injectable } from '@nestjs/common';
import { DisposalSaleRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../common/constants/roles.constants';
import { AlreadyProcessedError } from '../../common/utils/concurrency.util';
import { InsufficientStockError } from '../../common/utils/fefo.util';
import { InventoryLedgerService } from '../inventory/transactions/inventory-ledger.service';
import { variantMinimalSelect } from '../../common/selects/variant.select';
const disposalSaleRequestDetailSelect = {
    id: true,
    destinationId: true,
    destination: {
        select: { id: true, name: true, phone: true, email: true },
    },
    requestedById: true,
    requestedBy: { select: { id: true, fullName: true } },
    status: true,
    approvedById: true,
    approvedBy: { select: { id: true, fullName: true } },
    approvedAt: true,
    rejectionReason: true,
    confirmedById: true,
    confirmedBy: { select: { id: true, fullName: true } },
    confirmedAt: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
    items: {
        select: {
            id: true,
            variantId: true,
            batchId: true,
            quantity: true,
            price: true,
            variant: { select: variantMinimalSelect },
            batch: {
                select: { id: true, batchNumber: true, expirationDate: true },
            },
        },
    },
    images: {
        select: { id: true, sortOrder: true, createdAt: true },
        orderBy: { sortOrder: 'asc' },
    },
} satisfies Prisma.DisposalSaleRequestSelect;

const disposalSaleRequestListSelect = {
    id: true,
    destinationId: true,
    destination: { select: { id: true, name: true } },
    requestedById: true,
    status: true,
    createdAt: true,
} satisfies Prisma.DisposalSaleRequestSelect;

@Injectable()
export class DisposalSalesRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly inventoryLedger: InventoryLedgerService,
    ) {}

    async findMany(params: {
        skip: number;
        take: number;
        destinationId?: string;
        status?: DisposalSaleRequestStatus;
    }) {
        const where: Prisma.DisposalSaleRequestWhereInput = {
            destinationId: params.destinationId,
            status: params.status,
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.disposalSaleRequest.findMany({
                where,
                select: disposalSaleRequestListSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.disposalSaleRequest.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.disposalSaleRequest.findUnique({
            where: { id },
            select: disposalSaleRequestDetailSelect,
        });
    }

    destinationExists(id: string) {
        return this.prisma.destination.findUnique({
            where: { id },
            select: { id: true, isActive: true },
        });
    }

    findBatchForValidation(batchId: string) {
        return this.prisma.batch.findUnique({
            where: { id: batchId },
            select: { id: true, variantId: true },
        });
    }

    findBatchStock(batchId: string, departmentId: string) {
        return this.prisma.batchStock.findUnique({
            where: { batchId_departmentId: { batchId, departmentId } },
        });
    }

    findImageKeys(id: string) {
        return this.prisma.disposalSaleRequestImage.findMany({
            where: { requestId: id },
            select: { id: true, imageKey: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' },
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

    create(data: {
        destinationId: string;
        requestedById: string;
        notes?: string;
        items: {
            variantId: string;
            batchId: string;
            quantity: number;
            price: number;
        }[];
    }) {
        return this.prisma.disposalSaleRequest.create({
            data: {
                destinationId: data.destinationId,
                requestedById: data.requestedById,
                notes: data.notes,
                items: { create: data.items },
            },
            select: disposalSaleRequestDetailSelect,
        });
    }

    async updateStatus(
        id: string,
        expectedStatus: DisposalSaleRequestStatus,
        data: Prisma.DisposalSaleRequestUncheckedUpdateInput,
    ) {
        const claimed = await this.prisma.disposalSaleRequest.updateMany({
            where: { id, status: expectedStatus },
            data,
        });
        if (claimed.count === 0) {
            throw new AlreadyProcessedError(
                'This disposal sale request was already updated by another request.',
            );
        }
        return this.prisma.disposalSaleRequest.findUniqueOrThrow({
            where: { id },
            select: disposalSaleRequestDetailSelect,
        });
    }

    async addImages(
        id: string,
        imageKeys: string[],
        nextSortOrderStart: number,
    ) {
        await this.prisma.disposalSaleRequestImage.createMany({
            data: imageKeys.map((imageKey, index) => ({
                requestId: id,
                imageKey,
                sortOrder: nextSortOrderStart + index,
            })),
        });
        return this.prisma.disposalSaleRequest.findUniqueOrThrow({
            where: { id },
            select: disposalSaleRequestDetailSelect,
        });
    }

    confirmComplete(params: {
        requestId: string;
        warehouseDepartmentId: string;
        confirmedById: string;
        items: { batchId: string; variantId: string; quantity: number }[];
    }) {
        return this.prisma.$transaction(async (tx) => {
            const claimed = await tx.disposalSaleRequest.updateMany({
                where: {
                    id: params.requestId,
                    status: 'awaiting_confirmation',
                },
                data: {
                    status: 'completed',
                    confirmedById: params.confirmedById,
                    confirmedAt: new Date(),
                },
            });
            if (claimed.count === 0) {
                throw new AlreadyProcessedError(
                    'This disposal sale request has already been confirmed or is no longer awaiting confirmation.',
                );
            }

            for (const item of params.items) {
                const updated = await tx.$queryRaw<{ quantity: number }[]>`
                    UPDATE batch_stock
                    SET quantity = quantity - ${item.quantity}
                    WHERE batch_id = ${item.batchId}::uuid
                      AND department_id = ${params.warehouseDepartmentId}::uuid
                      AND quantity >= ${item.quantity}
                    RETURNING quantity::float AS "quantity"
                `;
                if (updated.length === 0) {
                    throw new InsufficientStockError(item.quantity);
                }

                await this.inventoryLedger.record(tx, {
                    transactionType: 'disposal_sale_out',
                    variantId: item.variantId,
                    batchId: item.batchId,
                    departmentId: params.warehouseDepartmentId,
                    quantity: -item.quantity,
                    balanceAfter: updated[0].quantity,
                    referenceType: 'disposal_sale_request',
                    referenceId: params.requestId,
                    performedById: params.confirmedById,
                });
            }

            return tx.disposalSaleRequest.findUniqueOrThrow({
                where: { id: params.requestId },
                select: disposalSaleRequestDetailSelect,
            });
        });
    }
}
