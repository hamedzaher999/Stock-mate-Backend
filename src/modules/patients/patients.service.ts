import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PatientsRepository } from './patients.repository';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { LookupPatientDto } from './dto/lookup-patient.dto';
import { ListPatientsDto } from './dto/list-patients.dto';
import { PaginatedResult } from '../../core/interfaces/paginated-result.interface';
import { generateRequestNumber } from '../../common/utils/request-number-generator.util';

@Injectable()
export class PatientsService {
    constructor(private readonly patientsRepository: PatientsRepository) {}

    async list(dto: ListPatientsDto): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } = await this.patientsRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
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
        const patient = await this.patientsRepository.findById(id);
        if (!patient) throw new NotFoundException('Patient not found.');
        return patient;
    }

    async lookup(dto: LookupPatientDto) {
        if (!dto.nationalId && !dto.familyBookNumber && !dto.patientId) {
            throw new BadRequestException(
                'Provide at least one of nationalId, familyBookNumber, or patientId to search.',
            );
        }

        if (dto.nationalId) {
            const match = await this.patientsRepository.findByNationalId(
                dto.nationalId,
            );
            if (match) return match;
        }

        if (dto.patientId) {
            const match = await this.patientsRepository.findByPatientId(
                dto.patientId,
            );
            if (match) return match;
        }

        if (dto.familyBookNumber) {
            const matches =
                await this.patientsRepository.findManyByFamilyBookNumber(
                    dto.familyBookNumber,
                );
            if (matches.length === 1) return matches[0];
            if (matches.length > 1) return { multipleMatches: matches };
        }

        return null;
    }

    async create(dto: CreatePatientDto, registeredById: string) {
        if (dto.nationalId) {
            const existing = await this.patientsRepository.findByNationalId(
                dto.nationalId,
            );
            if (existing) {
                throw new ConflictException(
                    'A patient with this National ID is already registered -- use the lookup endpoint to retrieve their existing record instead of creating a duplicate.',
                );
            }
        }

        if (dto.familyBookNumber) {
            const duplicateInFamily =
                await this.patientsRepository.findByFamilyBookNumberAndName(
                    dto.familyBookNumber,
                    dto.fullName,
                );
            if (duplicateInFamily) {
                throw new ConflictException(
                    'A patient with this name already exists under this family book number.',
                );
            }
        }

        const patientId =
            !dto.nationalId && !dto.familyBookNumber
                ? generateRequestNumber('PT')
                : undefined;

        return this.patientsRepository.create({
            fullName: dto.fullName,
            nationalId: dto.nationalId,
            familyBookNumber: dto.familyBookNumber,
            patientId,
            registeredById,
        });
    }

    async update(id: string, dto: UpdatePatientDto) {
        const current = await this.findById(id);

        if (dto.nationalId) {
            const existing = await this.patientsRepository.findByNationalId(
                dto.nationalId,
            );
            if (existing && existing.id !== id) {
                throw new ConflictException(
                    'A patient with this National ID is already registered.',
                );
            }
        }

        const effectiveFamilyBookNumber =
            dto.familyBookNumber ?? current.familyBookNumber;
        const effectiveFullName = dto.fullName ?? current.fullName;

        if (effectiveFamilyBookNumber) {
            const duplicateInFamily =
                await this.patientsRepository.findByFamilyBookNumberAndName(
                    effectiveFamilyBookNumber,
                    effectiveFullName,
                );
            if (duplicateInFamily && duplicateInFamily.id !== id) {
                throw new ConflictException(
                    'A patient with this name already exists under this family book number.',
                );
            }
        }

        return this.patientsRepository.update(id, dto);
    }
}
