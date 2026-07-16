import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { StockCountsService } from './stock-counts.service';
import { CreateStockCountSessionDto } from './dto/create-session.dto';
import { AddStockCountItemDto } from './dto/add-item.dto';
import { UpdateStockCountItemDto } from './dto/update-item.dto';
import { ListStockCountSessionsDto } from './dto/list-sessions.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('inventory/stock-counts')
@RequirePermissions(PERMISSIONS.PERFORM_STOCK_COUNT)
export class StockCountsController {
  constructor(private readonly stockCountsService: StockCountsService) {}

  @Get()
  async findAll(
    @Query() query: ListStockCountSessionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.stockCountsService.list(query, user.sub);
    return { message: 'Success', data };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.stockCountsService.findById(id, user.sub);
    return { message: 'Success', data };
  }

  @Post()
  async create(
    @Body() dto: CreateStockCountSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.stockCountsService.create(dto, user.sub);
    return { message: 'Stock count session started.', data };
  }

  @Post(':id/items')
  async addItem(
    @Param('id') id: string,
    @Body() dto: AddStockCountItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.stockCountsService.addItem(id, dto, user.sub);
    return { message: 'Item counted.', data };
  }

  @Patch(':id/items/:itemId')
  async updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateStockCountItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.stockCountsService.updateItem(
      id,
      itemId,
      dto,
      user.sub,
    );
    return { message: 'Item count updated.', data };
  }

  @Post(':id/complete')
  async complete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.stockCountsService.complete(id, user.sub);
    return { message: 'Stock count completed.', data };
  }
}
