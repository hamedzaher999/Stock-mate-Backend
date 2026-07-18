import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';

type TxClient = Prisma.TransactionClient;

const queueEntrySelect = {
    id: true,
    patientId: true,
    nationalId: true,
    familyBookNumber: true,
    patientName: true,
    prescriptionId: true,
    cycleNumber: true,
    medicationSummary: true,
    status: true,
    readySince: true,
    updatedAt: true,
} satisfies Prisma.PharmacyDispenseQueueSelect;

@Injectable()
export class DispenseQueueRepository {
    constructor(private readonly prisma: PrismaService) {}

    // --- Transactional sync methods, called from within other modules'
    // --- $transaction blocks (medical-visits, prescriptions) whenever a
    // --- prescription's dispense-readiness changes. This table is the
    // --- ONLY thing pharmacy queries -- it never reads `prescriptions`
    // --- directly, so these writes are the sole source of truth for it.

    async upsertReady(
        tx: TxClient,
        params: {
            prescriptionId: string;
            patientId: string;
            nationalId: string | null;
            familyBookNumber: string | null;
            patientName: string;
            cycleNumber: number;
            readySince: Date;
            items: { variantId: string; prescribedQuantity: number }[];
        },
    ) {
        const variantIds = params.items.map((i) => i.variantId);
        const variants = await tx.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, variantName: true },
        });
        const nameById = new Map(variants.map((v) => [v.id, v.variantName]));
        const medicationSummary = params.items
            .map(
                (i) =>
                    `${nameById.get(i.variantId) ?? 'Unknown'} x${i.prescribedQuantity}`,
            )
            .join(', ');

        return tx.pharmacyDispenseQueue.upsert({
            where: { prescriptionId: params.prescriptionId },
            update: {
                cycleNumber: params.cycleNumber,
                medicationSummary,
                status: 'ready',
                readySince: params.readySince,
            },
            create: {
                prescriptionId: params.prescriptionId,
                patientId: params.patientId,
                nationalId: params.nationalId,
                familyBookNumber: params.familyBookNumber,
                patientName: params.patientName,
                cycleNumber: params.cycleNumber,
                medicationSummary,
                status: 'ready',
                readySince: params.readySince,
            },
        });
    }

    removeForPrescription(tx: TxClient, prescriptionId: string) {
        return tx.pharmacyDispenseQueue.deleteMany({
            where: { prescriptionId },
        });
    }

    // --- Read-side, used by pharmacy staff. Ordinary PrismaService reads
    // --- (no tx needed) since these are outside any write transaction.

    async findMany(params: { skip: number; take: number }) {
        const [items, total] = await this.prisma.$transaction([
            this.prisma.pharmacyDispenseQueue.findMany({
                select: queueEntrySelect,
                skip: params.skip,
                take: params.take,
                orderBy: { readySince: 'asc' },
            }),
            this.prisma.pharmacyDispenseQueue.count(),
        ]);
        return { items, total };
    }

    findByNationalId(nationalId: string) {
        return this.prisma.pharmacyDispenseQueue.findMany({
            where: { nationalId },
            select: queueEntrySelect,
            orderBy: { readySince: 'asc' },
        });
    }

    findByFamilyBookNumber(familyBookNumber: string) {
        return this.prisma.pharmacyDispenseQueue.findMany({
            where: { familyBookNumber },
            select: queueEntrySelect,
            orderBy: { readySince: 'asc' },
        });
    }
}
