import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { Prisma, TransactionType } from '@prisma/client';
import { variantInventorySelect } from '../../../common/selects/variant.select';

const transactionSelect = {
    id: true,
    transactionType: true,
    variantId: true,
    batchId: true,
    departmentId: true,
    quantity: true,
    balanceAfter: true,
    referenceType: true,
    referenceId: true,
    transactionDate: true,
    notes: true,
    variant: { select: variantInventorySelect },
    batch: { select: { id: true, batchNumber: true } },
    department: { select: { id: true, name: true } },
    performedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.InventoryTransactionSelect;

@Injectable()
export class TransactionsRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findMany(params: {
        skip: number;
        take: number;
        departmentId?: string;
        variantId?: string;
        batchId?: string;
        transactionType?: TransactionType;
    }) {
        const where: Prisma.InventoryTransactionWhereInput = {
            departmentId: params.departmentId,
            variantId: params.variantId,
            batchId: params.batchId,
            transactionType: params.transactionType,
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.inventoryTransaction.findMany({
                where,
                select: transactionSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { transactionDate: 'desc' },
            }),
            this.prisma.inventoryTransaction.count({ where }),
        ]);

        return { items, total };
    }

    findRequestingUserContext(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: { departmentId: true, role: { select: { name: true } } },
        });
    }
}
