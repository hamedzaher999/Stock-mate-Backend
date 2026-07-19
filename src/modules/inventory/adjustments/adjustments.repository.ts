import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { InventoryLedgerService } from '../transactions/inventory-ledger.service';
import { Prisma, AdjustmentType, TransactionType } from '@prisma/client';
import { variantInventorySelect } from '../../../common/selects/variant.select';
const adjustmentSelect = {
    id: true,
    variantId: true,
    departmentId: true,
    batchId: true,
    adjustmentType: true,
    quantity: true,
    notes: true,
    createdAt: true,
    variant: { select: variantInventorySelect },
    department: { select: { id: true, name: true } },
    batch: { select: { id: true, batchNumber: true } },
    reportedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.InventoryAdjustmentSelect;

const ADJUSTMENT_TO_TRANSACTION_TYPE: Record<AdjustmentType, TransactionType> =
    {
        damaged: 'adjustment_damaged',
        expired: 'adjustment_expired',
        shrinkage: 'adjustment_shrinkage',
        found: 'adjustment_found',
    };

const INCREASING_ADJUSTMENT_TYPES: AdjustmentType[] = ['found'];

@Injectable()
export class AdjustmentsRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly inventoryLedger: InventoryLedgerService,
    ) {}

    async findMany(params: {
        skip: number;
        take: number;
        departmentId?: string;
        variantId?: string;
        adjustmentType?: AdjustmentType;
    }) {
        const where: Prisma.InventoryAdjustmentWhereInput = {
            departmentId: params.departmentId,
            variantId: params.variantId,
            adjustmentType: params.adjustmentType,
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.inventoryAdjustment.findMany({
                where,
                select: adjustmentSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.inventoryAdjustment.count({ where }),
        ]);

        return { items, total };
    }

    findRequestingUserContext(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: { departmentId: true, role: { select: { name: true } } },
        });
    }

    findBatch(batchId: string) {
        return this.prisma.batch.findUnique({
            where: { id: batchId },
            select: { id: true, variantId: true },
        });
    }

    findDepartmentType(id: string) {
        return this.prisma.department.findUnique({
            where: { id },
            select: {
                id: true,
                type: true,
                isActive: true,
                tracksInventory: true,
            },
        });
    }

    findVariantMaterialType(id: string) {
        return this.prisma.productVariant.findUnique({
            where: { id },
            select: {
                id: true,
                product: { select: { materialType: true } },
            },
        });
    }

    findBatchStock(batchId: string, departmentId: string) {
        return this.prisma.batchStock.findUnique({
            where: { batchId_departmentId: { batchId, departmentId } },
        });
    }

    stockCountSessionExists(id: string) {
        return this.prisma.stockCountSession.findUnique({
            where: { id },
            select: { id: true },
        });
    }

    createAdjustment(params: {
        variantId: string;
        departmentId: string;
        batchId: string;
        adjustmentType: AdjustmentType;
        quantity: number;
        notes?: string;
        reportedById: string;
        stockCountSessionId?: string;
    }) {
        return this.prisma.$transaction(async (tx) => {
            const adjustment = await tx.inventoryAdjustment.create({
                data: {
                    variantId: params.variantId,
                    departmentId: params.departmentId,
                    batchId: params.batchId,
                    adjustmentType: params.adjustmentType,
                    quantity: params.quantity,
                    notes: params.notes,
                    reportedById: params.reportedById,
                    referenceType: params.stockCountSessionId
                        ? 'stock_count'
                        : undefined,
                    referenceId: params.stockCountSessionId,
                },
            });

            const isIncreasing = INCREASING_ADJUSTMENT_TYPES.includes(
                params.adjustmentType,
            );

            const updatedStock = await tx.batchStock.update({
                where: {
                    batchId_departmentId: {
                        batchId: params.batchId,
                        departmentId: params.departmentId,
                    },
                },
                data: {
                    quantity: isIncreasing
                        ? { increment: params.quantity }
                        : { decrement: params.quantity },
                },
            });
            const balanceAfter = Number(updatedStock.quantity);

            await this.inventoryLedger.record(tx, {
                transactionType:
                    ADJUSTMENT_TO_TRANSACTION_TYPE[params.adjustmentType],
                variantId: params.variantId,
                batchId: params.batchId,
                departmentId: params.departmentId,
                quantity: isIncreasing ? params.quantity : -params.quantity,
                balanceAfter,
                referenceType: params.stockCountSessionId
                    ? 'stock_count'
                    : 'adjustment',
                referenceId: params.stockCountSessionId ?? adjustment.id,
                performedById: params.reportedById,
            });

            return tx.inventoryAdjustment.findUniqueOrThrow({
                where: { id: adjustment.id },
                select: adjustmentSelect,
            });
        });
    }
}
