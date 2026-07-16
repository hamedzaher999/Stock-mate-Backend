import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AdjustmentsService } from './adjustments.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { ListAdjustmentsDto } from './dto/list-adjustments.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('inventory/adjustments')
export class AdjustmentsController {
  constructor(private readonly adjustmentsService: AdjustmentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.VIEW_INVENTORY)
  async findAll(
    @Query() query: ListAdjustmentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.adjustmentsService.list(query, user.sub);
    return { message: 'Success', data };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PERFORM_INVENTORY_ADJUSTMENT)
  async create(
    @Body() dto: CreateAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.adjustmentsService.create(dto, user.sub);
    return { message: 'Adjustment recorded.', data };
  }
}
