import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RefillDeliveriesService } from './refill-deliveries.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';
import { ListDeliveriesDto } from './dto/list-deliveries.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('department-refills/deliveries')
export class RefillDeliveriesController {
  constructor(
    private readonly refillDeliveriesService: RefillDeliveriesService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PREPARE_DEPARTMENT_REFILL)
  async findAll(@Query() query: ListDeliveriesDto) {
    const data = await this.refillDeliveriesService.list(query);
    return { message: 'Success', data };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PREPARE_DEPARTMENT_REFILL)
  async findOne(@Param('id') id: string) {
    const data = await this.refillDeliveriesService.findById(id);
    return { message: 'Success', data };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PREPARE_DEPARTMENT_REFILL)
  async create(
    @Body() dto: CreateDeliveryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.refillDeliveriesService.create(dto, user.sub);
    return { message: 'Delivery shipped from warehouse stock.', data };
  }

  @Post(':id/confirm')
  @RequirePermissions(PERMISSIONS.CONFIRM_DEPARTMENT_DELIVERY)
  async confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmDeliveryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.refillDeliveriesService.confirm(
      id,
      dto,
      user.sub,
      user.sub,
    );
    return { message: 'Delivery confirmed.', data };
  }
}
