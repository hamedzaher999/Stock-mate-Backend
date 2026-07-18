import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const patientSelect = {
    id: true,
    fullName: true,
    nationalId: true,
    familyBookNumber: true,
    patientId: true,
    registeredById: true,
    registeredBy: { select: { id: true, fullName: true } },
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.PatientSelect;

@Injectable()
export class PatientsRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findMany(params: { skip: number; take: number; search?: string }) {
        const where: Prisma.PatientWhereInput = params.search
            ? {
                  OR: [
                      {
                          fullName: {
                              contains: params.search,
                              mode: 'insensitive',
                          },
                      },
                      {
                          nationalId: {
                              contains: params.search,
                              mode: 'insensitive',
                          },
                      },
                      {
                          familyBookNumber: {
                              contains: params.search,
                              mode: 'insensitive',
                          },
                      },
                      {
                          patientId: {
                              contains: params.search,
                              mode: 'insensitive',
                          },
                      },
                  ],
              }
            : {};

        const [items, total] = await this.prisma.$transaction([
            this.prisma.patient.findMany({
                where,
                select: patientSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.patient.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.patient.findUnique({
            where: { id },
            select: patientSelect,
        });
    }

    findByNationalId(nationalId: string) {
        return this.prisma.patient.findUnique({
            where: { nationalId },
            select: patientSelect,
        });
    }

    findByPatientId(patientId: string) {
        return this.prisma.patient.findUnique({
            where: { patientId },
            select: patientSelect,
        });
    }

    findByFamilyBookNumber(familyBookNumber: string) {
        return this.prisma.patient.findFirst({
            where: { familyBookNumber },
            select: patientSelect,
        });
    }

    findManyByFamilyBookNumber(familyBookNumber: string) {
        return this.prisma.patient.findMany({
            where: { familyBookNumber },
            select: patientSelect,
        });
    }

    create(data: {
        fullName: string;
        nationalId?: string;
        familyBookNumber?: string;
        patientId?: string;
        registeredById: string;
    }) {
        return this.prisma.patient.create({ data, select: patientSelect });
    }

    update(
        id: string,
        data: {
            fullName?: string;
            nationalId?: string;
            familyBookNumber?: string;
        },
    ) {
        return this.prisma.patient.update({
            where: { id },
            data,
            select: patientSelect,
        });
    }
}
