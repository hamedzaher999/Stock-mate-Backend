import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('catalog/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(@Query() query: ListProductsDto) {
    const data = await this.productsService.list(query);
    return { message: 'Success', data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.productsService.findById(id);
    return { message: 'Success', data };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MANAGE_MATERIALS)
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.productsService.create(dto, user.sub);
    return { message: 'Product created.', data };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.MANAGE_MATERIALS)
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    const data = await this.productsService.update(id, dto);
    return { message: 'Product updated.', data };
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.MANAGE_MATERIALS)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    const data = await this.productsService.updateStatus(id, dto);
    return {
      message: `Product marked as ${dto.isActive ? 'active' : 'inactive'}.`,
      data,
    };
  }
}
