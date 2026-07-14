import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { VariantsService } from './variants.service';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { UpdateVariantStatusDto } from './dto/update-variant-status.dto';
import { ListVariantsDto } from './dto/list-variants.dto';
import { SetVariantSuppliersDto } from './dto/set-variant-suppliers.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('catalog/variants')
export class VariantsController {
  constructor(private readonly variantsService: VariantsService) {}

  @Get()
  async findAll(@Query() query: ListVariantsDto) {
    const data = await this.variantsService.list(query);
    return { message: 'Success', data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.variantsService.findById(id);
    return { message: 'Success', data };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MANAGE_MATERIALS)
  async create(
    @Body() dto: CreateVariantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.variantsService.create(dto, user.sub);
    return { message: 'Variant created.', data };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.MANAGE_MATERIALS)
  async update(@Param('id') id: string, @Body() dto: UpdateVariantDto) {
    const data = await this.variantsService.update(id, dto);
    return { message: 'Variant updated.', data };
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.MANAGE_MATERIALS)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateVariantStatusDto,
  ) {
    const data = await this.variantsService.updateStatus(id, dto);
    return {
      message: `Variant marked as ${dto.isActive ? 'active' : 'inactive'}.`,
      data,
    };
  }

  @Put(':id/suppliers')
  @RequirePermissions(PERMISSIONS.MANAGE_MATERIAL_SUPPLIERS)
  async setSuppliers(
    @Param('id') id: string,
    @Body() dto: SetVariantSuppliersDto,
  ) {
    const data = await this.variantsService.setSuppliers(id, dto);
    return { message: 'Variant suppliers updated.', data };
  }
}
