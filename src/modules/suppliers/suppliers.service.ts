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

@Injectable()
export class SuppliersService {
    constructor(private readonly suppliersRepository: SuppliersRepository) {}

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

    async findById(id: string) {
        const supplier = await this.suppliersRepository.findById(id);
        if (!supplier) throw new NotFoundException('Supplier not found.');
        return supplier;
    }

    async create(dto: CreateSupplierDto) {
        const existing = await this.suppliersRepository.findByName(dto.name);
        if (existing)
            throw new ConflictException(
                'A supplier with this name already exists.',
            );
        return this.suppliersRepository.create(dto);
    }

    async update(id: string, dto: UpdateSupplierDto) {
        await this.findById(id);

        if (dto.name) {
            const existing = await this.suppliersRepository.findByName(
                dto.name,
            );
            if (existing && existing.id !== id) {
                throw new ConflictException(
                    'A supplier with this name already exists.',
                );
            }
        }

        return this.suppliersRepository.update(id, dto);
    }

    async updateStatus(id: string, dto: UpdateSupplierStatusDto) {
        await this.findById(id);
        return this.suppliersRepository.updateStatus(id, dto.isActive);
    }
}
