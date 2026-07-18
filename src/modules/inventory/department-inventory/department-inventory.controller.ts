import { Controller, Get, Param, Query } from '@nestjs/common';
import { DepartmentInventoryService } from './department-inventory.service';
import { ListDepartmentInventoryDto } from './dto/list-department-inventory.dto';
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

    @Get()
    async findAll(
        @Query() query: ListDepartmentInventoryDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.departmentInventoryService.list(
            query,
            user.sub,
        );
        return { message: 'Success', data };
    }

    @Get('live-stock')
    async liveStock(
        @Query() query: LiveStockQueryDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.departmentInventoryService.getLiveStock(
            query.departmentId,
            user.sub,
        );
        return { message: 'Success', data };
    }

    @Get(':id')
    async findOne(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.departmentInventoryService.findById(
            id,
            user.sub,
        );
        return { message: 'Success', data };
    }
}
