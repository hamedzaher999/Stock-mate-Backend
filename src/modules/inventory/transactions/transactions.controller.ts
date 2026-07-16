import { Controller, Get, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('inventory/transactions')
@RequirePermissions(PERMISSIONS.VIEW_INVENTORY)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async findAll(
    @Query() query: ListTransactionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.transactionsService.list(query, user.sub);
    return { message: 'Success', data };
  }
}
