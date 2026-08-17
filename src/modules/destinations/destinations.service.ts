import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ListDestinationsDto } from './dto/list-destinations.dto';
import { DestinationsRepository } from './destinations.repository';
import { PaginatedResult } from '../../core/interfaces/paginated-result.interface';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';
import { UpdateDestinationStatusDto } from './dto/update-destination-status.dto';

@Injectable()
export class DestinationsService {
    constructor(
        private readonly destinationsRepository: DestinationsRepository,
    ) {}

    async list(dto: ListDestinationsDto): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } = await this.destinationsRepository.findMany({
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
        const destination = await this.destinationsRepository.findById(id);
        if (!destination) throw new NotFoundException('Destination not found.');
        return destination;
    }

    async create(dto: CreateDestinationDto) {
        if (dto.phone) {
            const duplicatePhone =
                await this.destinationsRepository.findByNameAndPhone(
                    dto.name,
                    dto.phone,
                );
            if (duplicatePhone) {
                throw new ConflictException(
                    'A destination with this name and phone number already exists.',
                );
            }
        }

        if (dto.email) {
            const duplicateEmail =
                await this.destinationsRepository.findByNameAndEmail(
                    dto.name,
                    dto.email,
                );
            if (duplicateEmail) {
                throw new ConflictException(
                    'A destination with this name and email already exists.',
                );
            }
        }

        return this.destinationsRepository.create(dto);
    }

    async update(id: string, dto: UpdateDestinationDto) {
        const current = await this.findById(id);
        const effectiveName = dto.name ?? current.name;

        if (dto.phone || dto.name) {
            const phoneToCheck = dto.phone ?? current.phone;
            if (phoneToCheck) {
                const duplicatePhone =
                    await this.destinationsRepository.findByNameAndPhone(
                        effectiveName,
                        phoneToCheck,
                    );
                if (duplicatePhone && duplicatePhone.id !== id) {
                    throw new ConflictException(
                        'A destination with this name and phone number already exists.',
                    );
                }
            }
        }

        if (dto.email || dto.name) {
            const emailToCheck = dto.email ?? current.email;
            if (emailToCheck) {
                const duplicateEmail =
                    await this.destinationsRepository.findByNameAndEmail(
                        effectiveName,
                        emailToCheck,
                    );
                if (duplicateEmail && duplicateEmail.id !== id) {
                    throw new ConflictException(
                        'A destination with this name and email already exists.',
                    );
                }
            }
        }

        return this.destinationsRepository.update(id, dto);
    }

    async updateStatus(id: string, dto: UpdateDestinationStatusDto) {
        await this.findById(id);
        return this.destinationsRepository.updateStatus(id, dto.isActive);
    }
}
