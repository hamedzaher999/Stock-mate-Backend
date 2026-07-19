import { Controller, Get, Query } from '@nestjs/common';
import { DepartmentInventoryService } from './department-inventory.service';
import { LiveStockQueryDto } from './dto/live-stock-query.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('inventory/department-inventory')
@RequirePermissions(PERMISSIONS.VIEW_INVENTORY)
export class DepartmentInventoryController {
    constructor(
        private readonly departmentInventoryService: DepartmentInventoryService,
    ) {}

    @Get('live-stock')
    async liveStock(
        @Query() query: LiveStockQueryDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.departmentInventoryService.getLiveStock(
            query.departmentId,
            user.sub,
            query.page,
            query.limit,
        );
        return { message: 'Success', data };
    }
}
