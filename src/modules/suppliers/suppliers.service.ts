import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { SuppliersRepository } from './suppliers.repository';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { UpdateSupplierStatusDto } from './dto/update-supplier-status.dto';
import { ListSuppliersDto } from './dto/list-suppliers.dto';
import { PaginatedResult } from '../../core/interfaces/paginated-result.interface';
import { VariantsRepository } from '../catalog/variants/variants.repository';
import { ListSupplierVariantsDto } from './dto/list-supplier-variants.dto';

@Injectable()
export class SuppliersService {
    constructor(
        private readonly suppliersRepository: SuppliersRepository,
        private readonly variantsRepository: VariantsRepository,
    ) {}

    async list(dto: ListSuppliersDto): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } = await this.suppliersRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            isActive:
                dto.isActive === undefined
                    ? undefined
                    : dto.isActive === 'true',
            search: dto.search,
        });

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getLinkedVariants(
        supplierId: string,
        dto: ListSupplierVariantsDto,
    ): Promise<PaginatedResult<unknown>> {
        await this.findById(supplierId);

        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } = await this.variantsRepository.findBySupplier({
            supplierId,
            skip: (page - 1) * limit,
            take: limit,
        });

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async findById(id: string) {
        const supplier = await this.suppliersRepository.findById(id);
        if (!supplier) throw new NotFoundException('Supplier not found.');
        return supplier;
    }

    async create(dto: CreateSupplierDto) {
        if (dto.phone) {
            const duplicatePhone =
                await this.suppliersRepository.findByNameAndPhone(
                    dto.name,
                    dto.phone,
                );
            if (duplicatePhone) {
                throw new ConflictException(
                    'A supplier with this name and phone number already exists.',
                );
            }
        }

        if (dto.email) {
            const duplicateEmail =
                await this.suppliersRepository.findByNameAndEmail(
                    dto.name,
                    dto.email,
                );
            if (duplicateEmail) {
                throw new ConflictException(
                    'A supplier with this name and email already exists.',
                );
            }
        }

        return this.suppliersRepository.create(dto);
    }

    async update(id: string, dto: UpdateSupplierDto) {
        const current = await this.findById(id);
        const effectiveName = dto.name ?? current.name;

        if (dto.phone || dto.name) {
            const phoneToCheck = dto.phone ?? current.phone;
            if (phoneToCheck) {
                const duplicatePhone =
                    await this.suppliersRepository.findByNameAndPhone(
                        effectiveName,
                        phoneToCheck,
                    );
                if (duplicatePhone && duplicatePhone.id !== id) {
                    throw new ConflictException(
                        'A supplier with this name and phone number already exists.',
                    );
                }
            }
        }

        if (dto.email || dto.name) {
            const emailToCheck = dto.email ?? current.email;
            if (emailToCheck) {
                const duplicateEmail =
                    await this.suppliersRepository.findByNameAndEmail(
                        effectiveName,
                        emailToCheck,
                    );
                if (duplicateEmail && duplicateEmail.id !== id) {
                    throw new ConflictException(
                        'A supplier with this name and email already exists.',
                    );
                }
            }
        }

        return this.suppliersRepository.update(id, dto);
    }

    async updateStatus(id: string, dto: UpdateSupplierStatusDto) {
        await this.findById(id);
        return this.suppliersRepository.updateStatus(id, dto.isActive);
    }
}
