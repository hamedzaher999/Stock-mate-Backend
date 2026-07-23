import { Injectable } from '@nestjs/common';
import { Prisma, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { DispenseQueueRepository } from '../pharmacy/dispense-queue/dispense-queue.repository';
import { computeCycleEnd } from '../../common/utils/recurrence.util';

const visitDetailSelect = {
    id: true,
    patientId: true,
    doctorId: true,
    departmentId: true,
    queueEntryId: true,
    visitDate: true,
    clinicalNotes: true,
    diagnosis: true,
    externalMedications: true,
    status: true,
    cancelReason: true,
    cancelledById: true,
    cancelledAt: true,
    createdAt: true,
    updatedAt: true,
    patient: {
        select: { id: true, fullName: true, nationalId: true, patientId: true },
    },
    doctor: { select: { id: true, fullName: true, specialty: true } },
    department: { select: { id: true, name: true } },
} satisfies Prisma.MedicalVisitSelect;

const visitListSelect = {
    id: true,
    patientId: true,
    doctorId: true,
    departmentId: true,
    visitDate: true,
    status: true,
    patient: { select: { id: true, fullName: true } },
    doctor: { select: { id: true, fullName: true } },
} satisfies Prisma.MedicalVisitSelect;

@Injectable()
export class MedicalVisitsRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly dispenseQueueRepository: DispenseQueueRepository,
    ) {}

    async findMany(params: {
        skip: number;
        take: number;
        patientId?: string;
        doctorId?: string;
        departmentId?: string;
        status?: VisitStatus;
    }) {
        const where: Prisma.MedicalVisitWhereInput = {
            patientId: params.patientId,
            doctorId: params.doctorId,
            departmentId: params.departmentId,
            status: params.status,
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.medicalVisit.findMany({
                where,
                select: visitListSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { visitDate: 'desc' },
            }),
            this.prisma.medicalVisit.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.medicalVisit.findUnique({
            where: { id },
            select: visitDetailSelect,
        });
    }

    findAllForPatient(patientId: string) {
        return this.prisma.medicalVisit.findMany({
            where: { patientId },
            select: visitDetailSelect,
            orderBy: { visitDate: 'desc' },
        });
    }

    createCompletedVisit(params: {
        patientId: string;
        doctorId: string;
        departmentId: string;
        queueEntryId: string;
        clinicalNotes?: string;
        diagnosis?: string;
        externalMedications?: string;
        prescriptions?: {
            frequencyUnit?: 'day' | 'week' | 'month';
            frequencyInterval?: number;
            totalCycles?: number;
            startDate: Date;
            items: {
                variantId: string;
                prescribedQuantity: number;
                dosage?: string;
                frequency?: string;
                durationDays?: number;
            }[];
        }[];
    }) {
        return this.prisma.$transaction(async (tx) => {
            await tx.departmentQueue.update({
                where: { id: params.queueEntryId },
                data: { status: 'completed', completedAt: new Date() },
            });

            const visit = await tx.medicalVisit.create({
                data: {
                    patientId: params.patientId,
                    doctorId: params.doctorId,
                    departmentId: params.departmentId,
                    queueEntryId: params.queueEntryId,
                    clinicalNotes: params.clinicalNotes,
                    diagnosis: params.diagnosis,
                    externalMedications: params.externalMedications,
                    status: 'completed',
                },
            });

            if (params.prescriptions && params.prescriptions.length > 0) {
                const patient = await tx.patient.findUniqueOrThrow({
                    where: { id: params.patientId },
                    select: {
                        fullName: true,
                        nationalId: true,
                        familyBookNumber: true,
                    },
                });

                for (const rx of params.prescriptions) {
                    const cycleEnd = computeCycleEnd(
                        rx.startDate,
                        rx.frequencyUnit,
                        rx.frequencyInterval,
                    );

                    const created = await tx.prescription.create({
                        data: {
                            visitId: visit.id,
                            patientId: params.patientId,
                            doctorId: params.doctorId,
                            frequencyUnit: rx.frequencyUnit,
                            frequencyInterval: rx.frequencyInterval,
                            totalCycles: rx.totalCycles,
                            startDate: rx.startDate,
                            currentCycleStart: rx.startDate,
                            currentCycleEnd: cycleEnd,
                            items: {
                                create: rx.items.map((item) => ({
                                    variantId: item.variantId,
                                    prescribedQuantity: item.prescribedQuantity,
                                    dosage: item.dosage,
                                    frequency: item.frequency,
                                    durationDays: item.durationDays,
                                })),
                            },
                        },
                    });

                    // New prescription always starts at cycle 1, status 'ready' --
                    // immediately visible to pharmacy via the dispense queue.
                    await this.dispenseQueueRepository.upsertReady(tx, {
                        prescriptionId: created.id,
                        patientId: params.patientId,
                        nationalId: patient.nationalId,
                        familyBookNumber: patient.familyBookNumber,
                        patientName: patient.fullName,
                        cycleNumber: 1,
                        readySince: new Date(),
                        items: rx.items,
                    });
                }
            }

            return tx.medicalVisit.findUniqueOrThrow({
                where: { id: visit.id },
                select: visitDetailSelect,
            });
        });
    }

    cancel(params: { visitId: string; reason: string; cancelledById: string }) {
        return this.prisma.medicalVisit.update({
            where: { id: params.visitId },
            data: {
                status: 'cancelled',
                cancelReason: params.reason,
                cancelledById: params.cancelledById,
                cancelledAt: new Date(),
            },
            select: visitDetailSelect,
        });
    }
}
