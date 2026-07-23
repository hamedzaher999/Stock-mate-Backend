import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { UnitsRepository } from './units.repository';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { CatalogCacheService } from '../catalog-cache.service';

@Injectable()
export class UnitsService {
    constructor(
        private readonly unitsRepository: UnitsRepository,
        private readonly catalogCacheService: CatalogCacheService,
    ) {}
    findAll() {
        return this.catalogCacheService.getUnits();
    }

    async findById(id: string) {
        const units = await this.catalogCacheService.getUnits();
        const unit = units.find((u) => u.id === id);
        if (!unit) throw new NotFoundException('Unit not found.');
        return unit;
    }

    async create(dto: CreateUnitDto) {
        const existing = await this.unitsRepository.findByName(dto.name);
        if (existing)
            throw new ConflictException(
                'A unit with this name already exists.',
            );
        const created = await this.unitsRepository.create(dto);
        await this.catalogCacheService.invalidateUnits();
        return created;
    }

    async update(id: string, dto: UpdateUnitDto) {
        await this.findById(id);

        if (dto.name) {
            const existing = await this.unitsRepository.findByName(dto.name);
            if (existing && existing.id !== id) {
                throw new ConflictException(
                    'A unit with this name already exists.',
                );
            }
        }

        const updated = await this.unitsRepository.update(id, dto);
        await this.catalogCacheService.invalidateUnits();
        return updated;
    }

    async delete(id: string) {
        await this.findById(id);
        const count = await this.unitsRepository.countVariantsUsingUnit(id);
        if (count > 0)
            throw new BadRequestException(
                'Cannot delete a unit that is in use by product variants.',
            );
        await this.unitsRepository.delete(id);
        await this.catalogCacheService.invalidateUnits();
    }
}
