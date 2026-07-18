import { Injectable, NotFoundException } from '@nestjs/common';
import { BatchesRepository } from './batches.repository';
import { ListBatchesDto } from './dto/list-batches.dto';
import { PaginatedResult } from '../../core/interfaces/paginated-result.interface';

@Injectable()
export class BatchesService {
    constructor(private readonly batchesRepository: BatchesRepository) {}

    async list(dto: ListBatchesDto): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } = await this.batchesRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            variantId: dto.variantId,
            departmentId: dto.departmentId,
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
        const batch = await this.batchesRepository.findById(id);
        if (!batch) throw new NotFoundException('Batch not found.');
        return batch;
    }
}
