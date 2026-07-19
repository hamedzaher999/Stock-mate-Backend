import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { Prisma, StockCountStatus } from '@prisma/client';
import { variantInventorySelect } from '../../../common/selects/variant.select';
const sessionDetailSelect = {
    id: true,
    departmentId: true,
    department: { select: { id: true, name: true, type: true } },
    initiatedById: true,
    initiatedBy: { select: { id: true, fullName: true } },
    status: true,
    countDate: true,
    completedAt: true,
    notes: true,
    createdAt: true,
    items: {
        select: {
            id: true,
            variantId: true,
            batchId: true,
            expectedQuantity: true,
            countedQuantity: true,
            variance: true,
            notes: true,
            variant: { select: variantInventorySelect },
            batch: { select: { id: true, batchNumber: true } },
        },
    },
} satisfies Prisma.StockCountSessionSelect;

const sessionListSelect = {
    id: true,
    departmentId: true,
    department: { select: { id: true, name: true } },
    status: true,
    countDate: true,
    completedAt: true,
    createdAt: true,
} satisfies Prisma.StockCountSessionSelect;

@Injectable()
export class StockCountsRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findMany(params: {
        skip: number;
        take: number;
        departmentId?: string;
        status?: StockCountStatus;
    }) {
        const where: Prisma.StockCountSessionWhereInput = {
            departmentId: params.departmentId,
            status: params.status,
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.stockCountSession.findMany({
                where,
                select: sessionListSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.stockCountSession.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.stockCountSession.findUnique({
            where: { id },
            select: sessionDetailSelect,
        });
    }

    findRequestingUserContext(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: { departmentId: true, role: { select: { name: true } } },
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

    findVariant(id: string) {
        return this.prisma.productVariant.findUnique({
            where: { id },
            select: { id: true, isActive: true },
        });
    }

    findBatch(id: string) {
        return this.prisma.batch.findUnique({
            where: { id },
            select: { id: true, variantId: true },
        });
    }

    getLiveBatchQuantity(batchId: string, departmentId: string) {
        return this.prisma.batchStock.findUnique({
            where: { batchId_departmentId: { batchId, departmentId } },
            select: { quantity: true },
        });
    }

    createSession(data: {
        departmentId: string;
        initiatedById: string;
        countDate: Date;
        notes?: string;
    }) {
        return this.prisma.stockCountSession.create({
            data,
            select: sessionDetailSelect,
        });
    }

    addItem(data: {
        sessionId: string;
        variantId: string;
        batchId: string;
        expectedQuantity: number;
        countedQuantity: number;
        notes?: string;
    }) {
        return this.prisma.stockCountItem.create({
            data: {
                sessionId: data.sessionId,
                variantId: data.variantId,
                batchId: data.batchId,
                expectedQuantity: data.expectedQuantity,
                countedQuantity: data.countedQuantity,
                variance: data.countedQuantity - data.expectedQuantity,
                notes: data.notes,
            },
        });
    }

    findItemById(id: string) {
        return this.prisma.stockCountItem.findUnique({ where: { id } });
    }

    updateItem(
        id: string,
        countedQuantity: number,
        expectedQuantity: number,
        notes?: string,
    ) {
        return this.prisma.stockCountItem.update({
            where: { id },
            data: {
                countedQuantity,
                variance: countedQuantity - expectedQuantity,
                notes,
            },
        });
    }

    countItems(sessionId: string) {
        return this.prisma.stockCountItem.count({ where: { sessionId } });
    }

    completeSession(id: string) {
        return this.prisma.stockCountSession.update({
            where: { id },
            data: { status: 'completed', completedAt: new Date() },
            select: sessionDetailSelect,
        });
    }
}
