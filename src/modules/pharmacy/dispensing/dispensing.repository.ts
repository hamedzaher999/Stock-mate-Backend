import { Injectable } from '@nestjs/common';
import { FrequencyUnit, Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { InventoryLedgerService } from '../../inventory/transactions/inventory-ledger.service';
import { DispenseQueueRepository } from '../dispense-queue/dispense-queue.repository';
import { variantMinimalSelect } from '../../../common/selects/variant.select';
import {
    allocateFefo,
    InsufficientStockError,
} from '../../../common/utils/fefo.util';
import {
    AlreadyProcessedError,
    CycleAllowanceExceededError,
} from '../../../common/utils/concurrency.util';
import { computeCycleEnd } from '../../../common/utils/recurrence.util';

interface FefoCandidateRow {
    batchId: string;
    variantId: string;
    quantity: number;
    expirationDate: Date | null;
}

const dispenseDetailSelect = {
    id: true,
    prescriptionId: true,
    cycleNumber: true,
    dispensedById: true,
    dispensedAt: true,
    notes: true,
    items: {
        select: {
            id: true,
            prescriptionItemId: true,
            variantId: true,
            batchId: true,
            quantity: true,
            variant: { select: variantMinimalSelect },
            batch: {
                select: { id: true, batchNumber: true, expirationDate: true },
            },
        },
    },
} satisfies Prisma.PrescriptionDispenseSelect;

interface DispenseRequestedItem {
    prescriptionItemId: string;
    variantId: string;
    prescribedQuantity: number;
    quantity: number;
}

interface DispenseParams {
    prescriptionId: string;
    patientId: string;
    departmentId: string;
    cycleNumber: number;
    dispensedById: string;
    notes?: string;
    allItems: { prescriptionItemId: string; prescribedQuantity: number }[];
    requestedItems: DispenseRequestedItem[];
    isOneTime: boolean;
    isFinalCycle: boolean;
    frequencyUnit?: FrequencyUnit;
    frequencyInterval?: number;
    nextCycleStart?: Date;
    patientSnapshot: {
        nationalId: string | null;
        familyBookNumber: string | null;
        fullName: string;
    };
}

@Injectable()
export class DispensingRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly inventoryLedger: InventoryLedgerService,
        private readonly dispenseQueueRepository: DispenseQueueRepository,
    ) {}

    findPrescriptionForDispense(prescriptionId: string) {
        return this.prisma.prescription.findUnique({
            where: { id: prescriptionId },
            select: {
                id: true,
                patientId: true,
                status: true,
                frequencyUnit: true,
                frequencyInterval: true,
                totalCycles: true,
                currentCycleNumber: true,
                currentCycleStart: true,
                currentCycleEnd: true,
                currentCycleStatus: true,
                patient: {
                    select: {
                        id: true,
                        fullName: true,
                        nationalId: true,
                        familyBookNumber: true,
                    },
                },
                items: {
                    select: {
                        id: true,
                        variantId: true,
                        prescribedQuantity: true,
                    },
                },
            },
        });
    }

    async sumDispensedForCycle(prescriptionId: string, cycleNumber: number) {
        const rows = await this.prisma.prescriptionDispenseItem.groupBy({
            by: ['prescriptionItemId'],
            where: { dispense: { prescriptionId, cycleNumber } },
            _sum: { quantity: true },
        });
        return this.toQuantityMap(rows);
    }

    private async sumDispensedForCycleTx(
        tx: Prisma.TransactionClient,
        prescriptionId: string,
        cycleNumber: number,
    ) {
        const rows = await tx.prescriptionDispenseItem.groupBy({
            by: ['prescriptionItemId'],
            where: { dispense: { prescriptionId, cycleNumber } },
            _sum: { quantity: true },
        });
        return this.toQuantityMap(rows);
    }

    private toQuantityMap(
        rows: { prescriptionItemId: string; _sum: { quantity: unknown } }[],
    ): Map<string, number> {
        const map = new Map<string, number>();
        for (const row of rows) {
            map.set(row.prescriptionItemId, Number(row._sum.quantity ?? 0));
        }
        return map;
    }

    dispense(params: DispenseParams) {
        return this.prisma.$transaction(async (tx) => {
            const claimed = await tx.prescription.updateMany({
                where: {
                    id: params.prescriptionId,
                    status: 'active',
                    currentCycleNumber: params.cycleNumber,
                    currentCycleStatus: {
                        notIn: ['delivered', 'missed', 'cancelled'],
                    },
                },
                data: { updatedAt: new Date() },
            });
            if (claimed.count === 0) {
                throw new AlreadyProcessedError(
                    'This prescription cycle is no longer open for dispensing -- it may have been cancelled, renewed, or already resolved by another request.',
                );
            }

            const dispensedSoFar = await this.sumDispensedForCycleTx(
                tx,
                params.prescriptionId,
                params.cycleNumber,
            );

            const lines: {
                prescriptionItemId: string;
                variantId: string;
                quantity: number;
            }[] = [];

            for (const requested of params.requestedItems) {
                const already =
                    dispensedSoFar.get(requested.prescriptionItemId) ?? 0;
                const remaining = requested.prescribedQuantity - already;
                if (requested.quantity > remaining) {
                    throw new CycleAllowanceExceededError(
                        requested.prescriptionItemId,
                        remaining,
                    );
                }
                lines.push({
                    prescriptionItemId: requested.prescriptionItemId,
                    variantId: requested.variantId,
                    quantity: requested.quantity,
                });
            }

            const willBeFullyDelivered = params.allItems.every((item) => {
                const already =
                    dispensedSoFar.get(item.prescriptionItemId) ?? 0;
                const thisDispense =
                    lines.find(
                        (l) => l.prescriptionItemId === item.prescriptionItemId,
                    )?.quantity ?? 0;
                return already + thisDispense >= item.prescribedQuantity;
            });

            const dispense = await tx.prescriptionDispense.create({
                data: {
                    prescriptionId: params.prescriptionId,
                    cycleNumber: params.cycleNumber,
                    dispensedById: params.dispensedById,
                    notes: params.notes,
                },
            });

            const variantIds = [...new Set(lines.map((l) => l.variantId))];

            const candidates = await tx.$queryRaw<FefoCandidateRow[]>`
                SELECT
                    b.id AS "batchId",
                    b.variant_id AS "variantId",
                    bs.quantity::float AS "quantity",
                    b.expiration_date AS "expirationDate"
                FROM batch_stock bs
                JOIN batches b ON b.id = bs.batch_id
                WHERE bs.department_id = ${params.departmentId}::uuid
                  AND b.variant_id = ANY(${variantIds}::uuid[])
                  AND bs.quantity > 0
                FOR UPDATE OF bs
            `;

            const byVariant = new Map<string, FefoCandidateRow[]>();
            for (const row of candidates) {
                const list = byVariant.get(row.variantId) ?? [];
                list.push(row);
                byVariant.set(row.variantId, list);
            }

            for (const line of lines) {
                const rows = byVariant.get(line.variantId) ?? [];
                const allocations = allocateFefo(
                    rows.map((r) => ({
                        batchId: r.batchId,
                        expirationDate: r.expirationDate,
                        quantity: r.quantity,
                    })),
                    line.quantity,
                );

                for (const alloc of allocations) {
                    await tx.prescriptionDispenseItem.create({
                        data: {
                            dispenseId: dispense.id,
                            prescriptionItemId: line.prescriptionItemId,
                            variantId: line.variantId,
                            batchId: alloc.batchId,
                            quantity: alloc.quantity,
                        },
                    });

                    const updated = await tx.$queryRaw<{ quantity: number }[]>`
                        UPDATE batch_stock
                        SET quantity = quantity - ${alloc.quantity}
                        WHERE batch_id = ${alloc.batchId}::uuid
                          AND department_id = ${params.departmentId}::uuid
                          AND quantity >= ${alloc.quantity}
                        RETURNING quantity::float AS "quantity"
                    `;
                    if (updated.length === 0) {
                        throw new InsufficientStockError(alloc.quantity);
                    }

                    await this.inventoryLedger.record(tx, {
                        transactionType: 'prescription_dispense',
                        variantId: line.variantId,
                        batchId: alloc.batchId,
                        departmentId: params.departmentId,
                        quantity: -alloc.quantity,
                        balanceAfter: updated[0].quantity,
                        referenceType: 'prescription_dispense',
                        referenceId: dispense.id,
                        performedById: params.dispensedById,
                    });
                }

                await tx.prescriptionItem.update({
                    where: { id: line.prescriptionItemId },
                    data: { dispensedQuantity: { increment: line.quantity } },
                });
            }

            await this.resolveCycle(tx, {
                prescriptionId: params.prescriptionId,
                patientId: params.patientId,
                cycleNumber: params.cycleNumber,
                willBeFullyDelivered,
                isFinalCycle: params.isFinalCycle,
                frequencyUnit: params.frequencyUnit,
                frequencyInterval: params.frequencyInterval,
                nextCycleStart: params.nextCycleStart,
                patientSnapshot: params.patientSnapshot,
            });

            return tx.prescriptionDispense.findUniqueOrThrow({
                where: { id: dispense.id },
                select: dispenseDetailSelect,
            });
        });
    }

    private async resolveCycle(
        tx: Prisma.TransactionClient,
        params: {
            prescriptionId: string;
            patientId: string;
            cycleNumber: number;
            willBeFullyDelivered: boolean;
            isFinalCycle: boolean;
            frequencyUnit?: FrequencyUnit;
            frequencyInterval?: number;
            nextCycleStart?: Date;
            patientSnapshot: {
                nationalId: string | null;
                familyBookNumber: string | null;
                fullName: string;
            };
        },
    ) {
        if (!params.willBeFullyDelivered) {
            await tx.prescription.update({
                where: { id: params.prescriptionId },
                data: { currentCycleStatus: 'partially_delivered' },
            });
            await tx.pharmacyDispenseQueue.updateMany({
                where: { prescriptionId: params.prescriptionId },
                data: { status: 'partially_delivered' },
            });
            return;
        }

        const resolvedAt = new Date();
        const current = await tx.prescription.findUniqueOrThrow({
            where: { id: params.prescriptionId },
            select: { currentCycleStart: true, currentCycleEnd: true },
        });

        await tx.prescriptionCycleLog.create({
            data: {
                prescriptionId: params.prescriptionId,
                cycleNumber: params.cycleNumber,
                periodStart: current.currentCycleStart,
                periodEnd: current.currentCycleEnd,
                resolvedStatus: 'delivered',
                resolvedAt,
            },
        });

        if (params.isFinalCycle) {
            await tx.prescription.update({
                where: { id: params.prescriptionId },
                data: { status: 'completed', currentCycleStatus: 'delivered' },
            });
            await this.dispenseQueueRepository.removeForPrescription(
                tx,
                params.prescriptionId,
            );
            return;
        }

        const nextCycleNumber = params.cycleNumber + 1;
        const nextCycleStart = params.nextCycleStart ?? current.currentCycleEnd;
        const nextCycleEnd = computeCycleEnd(
            nextCycleStart,
            params.frequencyUnit,
            params.frequencyInterval,
        );

        await tx.prescription.update({
            where: { id: params.prescriptionId },
            data: {
                currentCycleNumber: nextCycleNumber,
                currentCycleStart: nextCycleStart,
                currentCycleEnd: nextCycleEnd,
                currentCycleStatus: 'ready',
            },
        });

        const items = await tx.prescriptionItem.findMany({
            where: { prescriptionId: params.prescriptionId },
            select: { variantId: true, prescribedQuantity: true },
        });

        await this.dispenseQueueRepository.upsertReady(tx, {
            prescriptionId: params.prescriptionId,
            patientId: params.patientId,
            nationalId: params.patientSnapshot.nationalId,
            familyBookNumber: params.patientSnapshot.familyBookNumber,
            patientName: params.patientSnapshot.fullName,
            cycleNumber: nextCycleNumber,
            readySince: resolvedAt,
            items: items.map((i) => ({
                variantId: i.variantId,
                prescribedQuantity: Number(i.prescribedQuantity),
            })),
        });
    }
}
