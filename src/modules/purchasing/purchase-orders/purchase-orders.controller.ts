import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ListPurchaseOrdersDto } from './dto/list-purchase-orders.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('purchasing/orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.VIEW_PURCHASING_HISTORY)
  async findAll(@Query() query: ListPurchaseOrdersDto) {
    const data = await this.purchaseOrdersService.list(query);
    return { message: 'Success', data };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.VIEW_PURCHASING_HISTORY)
  async findOne(@Param('id') id: string) {
    const data = await this.purchaseOrdersService.findById(id);
    return { message: 'Success', data };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MANAGE_PURCHASE_ORDERS)
  async create(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.purchaseOrdersService.create(dto, user.sub);
    return { message: 'Purchase order created.', data };
  }

  @Post(':id/send')
  @RequirePermissions(PERMISSIONS.MANAGE_PURCHASE_ORDERS)
  async send(@Param('id') id: string) {
    const data = await this.purchaseOrdersService.send(id);
    return { message: 'Purchase order sent to supplier.', data };
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.MANAGE_PURCHASE_ORDERS)
  async cancel(@Param('id') id: string) {
    const data = await this.purchaseOrdersService.cancel(id);
    return { message: 'Purchase order cancelled.', data };
  }
}
