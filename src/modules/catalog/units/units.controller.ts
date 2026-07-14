import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('catalog/units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  async findAll() {
    const data = await this.unitsService.findAll();
    return { message: 'Success', data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.unitsService.findById(id);
    return { message: 'Success', data };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MANAGE_UNITS)
  async create(@Body() dto: CreateUnitDto) {
    const data = await this.unitsService.create(dto);
    return { message: 'Unit created.', data };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.MANAGE_UNITS)
  async update(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    const data = await this.unitsService.update(id, dto);
    return { message: 'Unit updated.', data };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.MANAGE_UNITS)
  async remove(@Param('id') id: string) {
    await this.unitsService.delete(id);
    return { message: 'Unit deleted.', data: null };
  }
}
