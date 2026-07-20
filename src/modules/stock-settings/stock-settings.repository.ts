import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const stockSettingSelect = {
    id: true,
    variantId: true,
    departmentId: true,
    storageLocation: true,
    minimumStock: true,
    maximumStock: true,
    isActive: true,
    variant: { select: { id: true, variantName: true, sku: true } },
    department: { select: { id: true, name: true, type: true } },
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.DepartmentStockSettingSelect;

@Injectable()
export class StockSettingsRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findMany(params: {
        skip: number;
        take: number;
        departmentId?: string;
        variantId?: string;
        isActive?: boolean;
    }) {
        const where: Prisma.DepartmentStockSettingWhereInput = {
            departmentId: params.departmentId,
            variantId: params.variantId,
            isActive: params.isActive,
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.departmentStockSetting.findMany({
                where,
                select: stockSettingSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.departmentStockSetting.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.departmentStockSetting.findUnique({
            where: { id },
            select: stockSettingSelect,
        });
    }

    findByVariantAndDepartment(variantId: string, departmentId: string) {
        return this.prisma.departmentStockSetting.findUnique({
            where: { variantId_departmentId: { variantId, departmentId } },
        });
    }

    variantExists(id: string) {
        return this.prisma.productVariant.findUnique({
            where: { id },
            select: {
                id: true,
                isActive: true,
                product: { select: { isActive: true } },
            },
        });
    }

    departmentExists(id: string) {
        return this.prisma.department.findUnique({
            where: { id },
            select: { id: true, type: true, isActive: true },
        });
    }

    findRequestingUser(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: { departmentId: true, role: { select: { name: true } } },
        });
    }

    create(data: {
        variantId: string;
        departmentId: string;
        storageLocation?: string;
        minimumStock?: number;
        maximumStock?: number;
        createdById: string;
    }) {
        return this.prisma.departmentStockSetting.create({
            data,
            select: stockSettingSelect,
        });
    }

    update(
        id: string,
        data: {
            storageLocation?: string;
            minimumStock?: number;
            maximumStock?: number;
        },
    ) {
        return this.prisma.departmentStockSetting.update({
            where: { id },
            data,
            select: stockSettingSelect,
        });
    }

    updateStatus(id: string, isActive: boolean) {
        return this.prisma.departmentStockSetting.update({
            where: { id },
            data: { isActive },
            select: stockSettingSelect,
        });
    }

    delete(id: string) {
        return this.prisma.departmentStockSetting.delete({ where: { id } });
    }
    findActiveThresholdSettings() {
        return this.prisma.departmentStockSetting.findMany({
            where: {
                isActive: true,
                OR: [
                    { minimumStock: { not: null } },
                    { maximumStock: { not: null } },
                ],
                department: { isActive: true, tracksInventory: true },
                variant: { isActive: true, product: { isActive: true } },
            },
            select: {
                id: true,
                variantId: true,
                departmentId: true,
                minimumStock: true,
                maximumStock: true,
                variant: { select: { id: true, variantName: true, sku: true } },
                department: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        managerId: true,
                        manager: { select: { id: true, fullName: true } },
                    },
                },
            },
        });
    }

    async getLiveQuantities(
        pairs: { variantId: string; departmentId: string }[],
    ): Promise<Map<string, number>> {
        if (pairs.length === 0) return new Map();

        const departmentIds = [...new Set(pairs.map((p) => p.departmentId))];

        const rows = await this.prisma.batchStock.findMany({
            where: { departmentId: { in: departmentIds } },
            select: {
                departmentId: true,
                quantity: true,
                batch: { select: { variantId: true } },
            },
        });

        const map = new Map<string, number>();
        for (const row of rows) {
            const key = `${row.batch.variantId}:${row.departmentId}`;
            map.set(key, (map.get(key) ?? 0) + Number(row.quantity));
        }
        return map;
    }
}
