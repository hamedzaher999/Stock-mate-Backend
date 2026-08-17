import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

const destinationSelect = {
    id: true,
    name: true,
    phone: true,
    email: true,
    address: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.DestinationSelect;

@Injectable()
export class DestinationsRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findMany(params: {
        skip: number;
        take: number;
        isActive?: boolean;
        search?: string;
    }) {
        const where: Prisma.DestinationWhereInput = {
            isActive: params.isActive,
            ...(params.search && {
                name: { contains: params.search, mode: 'insensitive' },
            }),
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.destination.findMany({
                where,
                select: destinationSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { name: 'asc' },
            }),
            this.prisma.destination.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.destination.findUnique({
            where: { id },
            select: destinationSelect,
        });
    }

    findByNameAndPhone(name: string, phone: string) {
        return this.prisma.destination.findFirst({ where: { name, phone } });
    }

    findByNameAndEmail(name: string, email: string) {
        return this.prisma.destination.findFirst({ where: { name, email } });
    }

    create(data: {
        name: string;
        phone?: string;
        email?: string;
        address?: string;
    }) {
        return this.prisma.destination.create({
            data,
            select: destinationSelect,
        });
    }

    update(
        id: string,
        data: {
            name?: string;
            phone?: string;
            email?: string;
            address?: string;
        },
    ) {
        return this.prisma.destination.update({
            where: { id },
            data,
            select: destinationSelect,
        });
    }

    updateStatus(id: string, isActive: boolean) {
        return this.prisma.destination.update({
            where: { id },
            data: { isActive },
            select: destinationSelect,
        });
    }
}
