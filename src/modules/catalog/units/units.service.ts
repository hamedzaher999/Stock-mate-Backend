import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UnitsRepository } from './units.repository';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(private readonly unitsRepository: UnitsRepository) {}

  findAll() {
    return this.unitsRepository.findAll();
  }

  async findById(id: string) {
    const unit = await this.unitsRepository.findById(id);
    if (!unit) throw new NotFoundException('Unit not found.');
    return unit;
  }

  async create(dto: CreateUnitDto) {
    const existing = await this.unitsRepository.findByName(dto.name);
    if (existing)
      throw new ConflictException('A unit with this name already exists.');
    return this.unitsRepository.create(dto);
  }

  async update(id: string, dto: UpdateUnitDto) {
    await this.findById(id);

    if (dto.name) {
      const existing = await this.unitsRepository.findByName(dto.name);
      if (existing && existing.id !== id) {
        throw new ConflictException('A unit with this name already exists.');
      }
    }

    return this.unitsRepository.update(id, dto);
  }

  async delete(id: string) {
    await this.findById(id);
    const count = await this.unitsRepository.countVariantsUsingUnit(id);
    if (count > 0)
      throw new BadRequestException(
        'Cannot delete a unit that is in use by product variants.',
      );
    return this.unitsRepository.delete(id);
  }
}
