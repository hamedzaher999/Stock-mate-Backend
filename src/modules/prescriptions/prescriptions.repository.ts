import { Injectable } from '@nestjs/common';
import { Prisma, PrescriptionStatus } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { DispenseQueueRepository } from '../pharmacy/dispense-queue/dispense-queue.repository';

const prescriptionDetailSelect = {
    id: true,
    visitId: true,
    patientId: true,
    doctorId: true,
    status: true,
    frequencyUnit: true,
    frequencyInterval: true,
    startDate: true,
    totalCycles: true,
    currentCycleNumber: true,
    currentCycleStart: true,
    currentCycleEnd: true,
    currentCycleStatus: true,
    renewedFromPrescriptionId: true,
    cancelReason: true,
    cancelledById: true,
    cancelledAt: true,
    createdAt: true,
    updatedAt: true,
    patient: { select: { id: true, fullName: true } },
    doctor: { select: { id: true, fullName: true } },
    items: {
        select: {
            id: true,
            variantId: true,
            prescribedQuantity: true,
            dosage: true,
            frequency: true,
            durationDays: true,
            dispensedQuantity: true,
            variant: { select: { id: true, variantName: true, sku: true } },
        },
    },
} satisfies Prisma.PrescriptionSelect;

const prescriptionListSelect = {
    id: true,
    visitId: true,
    patientId: true,
    doctorId: true,
    status: true,
    currentCycleStatus: true,
    startDate: true,
    patient: { select: { id: true, fullName: true } },
    doctor: { select: { id: true, fullName: true } },
} satisfies Prisma.PrescriptionSelect;

@Injectable()
export class PrescriptionsRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly dispenseQueueRepository: DispenseQueueRepository,
    ) {}

    async findMany(params: {
        skip: number;
        take: number;
        patientId?: string;
        doctorId?: string;
        status?: PrescriptionStatus;
    }) {
        const where: Prisma.PrescriptionWhereInput = {
            patientId: params.patientId,
            doctorId: params.doctorId,
            status: params.status,
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.prescription.findMany({
                where,
                select: prescriptionListSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.prescription.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.prescription.findUnique({
            where: { id },
            select: prescriptionDetailSelect,
        });
    }

    findVisit(visitId: string) {
        return this.prisma.medicalVisit.findUnique({
            where: { id: visitId },
            select: { id: true, patientId: true, doctorId: true, status: true },
        });
    }

    cancel(params: {
        prescriptionId: string;
        reason: string;
        cancelledById: string;
    }) {
        return this.prisma.$transaction(async (tx) => {
            const cancelled = await tx.prescription.update({
                where: { id: params.prescriptionId },
                data: {
                    status: 'cancelled',
                    currentCycleStatus: 'cancelled',
                    cancelReason: params.reason,
                    cancelledById: params.cancelledById,
                    cancelledAt: new Date(),
                },
                select: prescriptionDetailSelect,
            });

            await this.dispenseQueueRepository.removeForPrescription(
                tx,
                params.prescriptionId,
            );

            return cancelled;
        });
    }

    renew(params: {
        oldPrescriptionId: string;
        visitId: string;
        patientId: string;
        doctorId: string;
        frequencyUnit?: 'day' | 'week' | 'month';
        frequencyInterval?: number;
        totalCycles?: number;
        startDate: Date;
        currentCycleEnd: Date;
        items: {
            variantId: string;
            prescribedQuantity: number;
            dosage?: string;
            frequency?: string;
            durationDays?: number;
        }[];
    }) {
        return this.prisma.$transaction(async (tx) => {
            await tx.prescription.update({
                where: { id: params.oldPrescriptionId },
                data: { status: 'completed' },
            });
            await this.dispenseQueueRepository.removeForPrescription(
                tx,
                params.oldPrescriptionId,
            );

            const patient = await tx.patient.findUniqueOrThrow({
                where: { id: params.patientId },
                select: {
                    fullName: true,
                    nationalId: true,
                    familyBookNumber: true,
                },
            });

            const created = await tx.prescription.create({
                data: {
                    visitId: params.visitId,
                    patientId: params.patientId,
                    doctorId: params.doctorId,
                    frequencyUnit: params.frequencyUnit,
                    frequencyInterval: params.frequencyInterval,
                    totalCycles: params.totalCycles,
                    startDate: params.startDate,
                    currentCycleStart: params.startDate,
                    currentCycleEnd: params.currentCycleEnd,
                    renewedFromPrescriptionId: params.oldPrescriptionId,
                    items: { create: params.items },
                },
            });

            await this.dispenseQueueRepository.upsertReady(tx, {
                prescriptionId: created.id,
                patientId: params.patientId,
                nationalId: patient.nationalId,
                familyBookNumber: patient.familyBookNumber,
                patientName: patient.fullName,
                cycleNumber: 1,
                readySince: new Date(),
                items: params.items,
            });

            return tx.prescription.findUniqueOrThrow({
                where: { id: created.id },
                select: prescriptionDetailSelect,
            });
        });
    }
}
