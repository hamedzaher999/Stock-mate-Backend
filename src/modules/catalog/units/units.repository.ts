import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

@Injectable()
export class UnitsRepository {
    constructor(private readonly prisma: PrismaService) {}

    findAll() {
        return this.prisma.unit.findMany({ orderBy: { name: 'asc' } });
    }

    findById(id: string) {
        return this.prisma.unit.findUnique({ where: { id } });
    }

    findByName(name: string) {
        return this.prisma.unit.findFirst({ where: { name } });
    }

    create(data: { name: string; abbreviation?: string }) {
        return this.prisma.unit.create({ data });
    }

    update(id: string, data: { name?: string; abbreviation?: string }) {
        return this.prisma.unit.update({ where: { id }, data });
    }

    countVariantsUsingUnit(id: string) {
        return this.prisma.productVariant.count({ where: { unitId: id } });
    }

    delete(id: string) {
        return this.prisma.unit.delete({ where: { id } });
    }
}
