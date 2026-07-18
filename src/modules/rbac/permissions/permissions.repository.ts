import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

@Injectable()
export class PermissionsRepository {
    constructor(private readonly prisma: PrismaService) {}

    findAll() {
        return this.prisma.permission.findMany({
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        });
    }

    findByCodes(codes: string[]) {
        return this.prisma.permission.findMany({
            where: { code: { in: codes } },
        });
    }
}
