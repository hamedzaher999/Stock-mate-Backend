import { BadRequestException, Injectable } from '@nestjs/common';
import { DispenseQueueRepository } from './dispense-queue.repository';
import { ListDispenseQueueDto } from './dto/list-dispense-queue.dto';
import { LookupDispenseQueueDto } from './dto/lookup-dispense-queue.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';

@Injectable()
export class DispenseQueueService {
    constructor(
        private readonly dispenseQueueRepository: DispenseQueueRepository,
    ) {}

    async list(dto: ListDispenseQueueDto): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } = await this.dispenseQueueRepository.findMany({
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

    async lookup(dto: LookupDispenseQueueDto) {
        if (!dto.nationalId && !dto.familyBookNumber) {
            throw new BadRequestException(
                'Provide a nationalId or familyBookNumber to search.',
            );
        }

        if (dto.nationalId) {
            const results = await this.dispenseQueueRepository.findByNationalId(
                dto.nationalId,
            );
            return { ambiguous: false, results };
        }

        const results =
            await this.dispenseQueueRepository.findByFamilyBookNumber(
                dto.familyBookNumber as string,
            );

        // familyBookNumber is shared across a family -- group by patient so
        // the pharmacist picks the right person by name before dispensing.
        const byPatient = new Map<
            string,
            { patientId: string; patientName: string; entries: typeof results }
        >();
        for (const entry of results) {
            if (!byPatient.has(entry.patientId)) {
                byPatient.set(entry.patientId, {
                    patientId: entry.patientId,
                    patientName: entry.patientName,
                    entries: [],
                });
            }
            byPatient.get(entry.patientId)!.entries.push(entry);
        }

        return {
            ambiguous: byPatient.size > 1,
            results: Array.from(byPatient.values()),
        };
    }
}
