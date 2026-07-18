import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma, UserStatus } from '@prisma/client';

const userListSelect = {
    id: true,
    fullName: true,
    phone: true,
    email: true,
    specialty: true,
    status: true,
    roleId: true,
    departmentId: true,
    role: { select: { id: true, name: true } },
    department: { select: { id: true, name: true } },
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findMany(params: {
        skip: number;
        take: number;
        departmentId?: string;
        roleId?: string;
        status?: UserStatus;
        search?: string;
    }) {
        const where: Prisma.UserWhereInput = {
            departmentId: params.departmentId,
            roleId: params.roleId,
            status: params.status,
            ...(params.search && {
                OR: [
                    {
                        fullName: {
                            contains: params.search,
                            mode: 'insensitive',
                        },
                    },
                    { phone: { contains: params.search, mode: 'insensitive' } },
                    { email: { contains: params.search, mode: 'insensitive' } },
                ],
            }),
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where,
                select: userListSelect,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count({ where }),
        ]);

        return { items, total };
    }

    findById(id: string) {
        return this.prisma.user.findUnique({
            where: { id },
            select: userListSelect,
        });
    }

    findByPhoneOrEmail(phone?: string, email?: string) {
        const conditions: Prisma.UserWhereInput[] = [];
        if (phone) conditions.push({ phone });
        if (email) conditions.push({ email });
        if (conditions.length === 0) return Promise.resolve(null);

        return this.prisma.user.findFirst({ where: { OR: conditions } });
    }

    findByPhoneOrEmailExcluding(
        excludeId: string,
        phone?: string,
        email?: string,
    ) {
        const conditions: Prisma.UserWhereInput[] = [];
        if (phone) conditions.push({ phone });
        if (email) conditions.push({ email });
        if (conditions.length === 0) return Promise.resolve(null);

        return this.prisma.user.findFirst({
            where: { AND: [{ OR: conditions }, { id: { not: excludeId } }] },
        });
    }

    findRoleById(id: string) {
        return this.prisma.role.findUnique({ where: { id } });
    }

    departmentExists(id: string) {
        return this.prisma.department.findUnique({
            where: { id },
            select: { id: true },
        });
    }

    create(data: {
        fullName: string;
        phone?: string;
        email?: string;
        roleId: string;
        departmentId?: string;
        specialty?: string;
        createdById: string;
    }) {
        return this.prisma.user.create({ data, select: userListSelect });
    }

    update(
        id: string,
        data: {
            fullName?: string;
            phone?: string;
            email?: string;
            roleId?: string;
            departmentId?: string;
            specialty?: string;
        },
    ) {
        return this.prisma.user.update({
            where: { id },
            data,
            select: userListSelect,
        });
    }

    updateStatus(id: string, status: UserStatus) {
        return this.prisma.user.update({
            where: { id },
            data: { status },
            select: userListSelect,
        });
    }

    countActiveByRoleName(roleName: string) {
        return this.prisma.user.count({
            where: { status: 'active', role: { name: roleName } },
        });
    }
}
