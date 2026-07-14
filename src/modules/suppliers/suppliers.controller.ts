import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { UpdateSupplierStatusDto } from './dto/update-supplier-status.dto';
import { ListSuppliersDto } from './dto/list-suppliers.dto';
import { RequirePermissions } from '../../core/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions.constants';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  async findAll(@Query() query: ListSuppliersDto) {
    const data = await this.suppliersService.list(query);
    return { message: 'Success', data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.suppliersService.findById(id);
    return { message: 'Success', data };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MANAGE_SUPPLIERS)
  async create(@Body() dto: CreateSupplierDto) {
    const data = await this.suppliersService.create(dto);
    return { message: 'Supplier created.', data };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.MANAGE_SUPPLIERS)
  async update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    const data = await this.suppliersService.update(id, dto);
    return { message: 'Supplier updated.', data };
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.MANAGE_SUPPLIERS)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierStatusDto,
  ) {
    const data = await this.suppliersService.updateStatus(id, dto);
    return {
      message: `Supplier marked as ${dto.isActive ? 'active' : 'inactive'}.`,
      data,
    };
  }
}
