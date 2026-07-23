import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { InventoryLedgerService } from '../../inventory/transactions/inventory-ledger.service';
import { DispenseQueueRepository } from '../dispense-queue/dispense-queue.repository';
import { variantMinimalSelect } from '../../../common/selects/variant.select';
import {
    allocateFefo,
    InsufficientStockError,
} from '../../../common/utils/fefo.util';
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

export type CycleResolution =
    | { type: 'partial' }
    | { type: 'resolved_final'; resolvedAt: Date }
    | {
          type: 'resolved_advance';
          resolvedAt: Date;
          nextCycleNumber: number;
          nextCycleStart: Date;
          nextCycleEnd: Date;
      };

interface DispenseParams {
    prescriptionId: string;
    patientId: string;
    departmentId: string;
    cycleNumber: number;
    dispensedById: string;
    notes?: string;
    lines: {
        prescriptionItemId: string;
        variantId: string;
        quantity: number;
    }[];
    cycleResolution: CycleResolution;
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
        const map = new Map<string, number>();
        for (const row of rows) {
            map.set(row.prescriptionItemId, Number(row._sum.quantity ?? 0));
        }
        return map;
    }

    dispense(params: DispenseParams) {
        return this.prisma.$transaction(async (tx) => {
            const dispense = await tx.prescriptionDispense.create({
                data: {
                    prescriptionId: params.prescriptionId,
                    cycleNumber: params.cycleNumber,
                    dispensedById: params.dispensedById,
                    notes: params.notes,
                },
            });

            const variantIds = [
                ...new Set(params.lines.map((l) => l.variantId)),
            ];

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

            for (const line of params.lines) {
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

            await this.resolveCycle(tx, params);

            return tx.prescriptionDispense.findUniqueOrThrow({
                where: { id: dispense.id },
                select: dispenseDetailSelect,
            });
        });
    }

    private async resolveCycle(
        tx: Prisma.TransactionClient,
        params: DispenseParams,
    ) {
        const { cycleResolution } = params;

        if (cycleResolution.type === 'partial') {
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
                resolvedAt: cycleResolution.resolvedAt,
            },
        });

        if (cycleResolution.type === 'resolved_final') {
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

        await tx.prescription.update({
            where: { id: params.prescriptionId },
            data: {
                currentCycleNumber: cycleResolution.nextCycleNumber,
                currentCycleStart: cycleResolution.nextCycleStart,
                currentCycleEnd: cycleResolution.nextCycleEnd,
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
            cycleNumber: cycleResolution.nextCycleNumber,
            readySince: cycleResolution.resolvedAt,
            items: items.map((i) => ({
                variantId: i.variantId,
                prescribedQuantity: Number(i.prescribedQuantity),
            })),
        });
    }
}
