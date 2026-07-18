import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { StockSettingsService } from './stock-settings.service';
import { CreateStockSettingDto } from './dto/create-stock-setting.dto';
import { UpdateStockSettingDto } from './dto/update-stock-setting.dto';
import { UpdateStockSettingStatusDto } from './dto/update-stock-setting-status.dto';
import { ListStockSettingsDto } from './dto/list-stock-settings.dto';
import { RequirePermissions } from '../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../common/constants/permissions.constants';

@Controller('stock-settings')
export class StockSettingsController {
    constructor(private readonly stockSettingsService: StockSettingsService) {}

    @Get()
    @RequirePermissions(PERMISSIONS.VIEW_INVENTORY)
    async findAll(@Query() query: ListStockSettingsDto) {
        const data = await this.stockSettingsService.list(query);
        return { message: 'Success', data };
    }

    @Get(':id')
    @RequirePermissions(PERMISSIONS.VIEW_INVENTORY)
    async findOne(@Param('id') id: string) {
        const data = await this.stockSettingsService.findById(id);
        return { message: 'Success', data };
    }

    @Post()
    @RequirePermissions(PERMISSIONS.MANAGE_DEPARTMENT_MATERIALS)
    async create(
        @Body() dto: CreateStockSettingDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.stockSettingsService.create(dto, user.sub);
        return { message: 'Stock setting created.', data };
    }

    @Patch(':id')
    @RequirePermissions(PERMISSIONS.MANAGE_DEPARTMENT_MATERIALS)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateStockSettingDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.stockSettingsService.update(id, dto, user.sub);
        return { message: 'Stock setting updated.', data };
    }

    @Patch(':id/status')
    @RequirePermissions(PERMISSIONS.MANAGE_DEPARTMENT_MATERIALS)
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateStockSettingStatusDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.stockSettingsService.updateStatus(
            id,
            dto,
            user.sub,
        );
        return {
            message: `Stock setting marked as ${dto.isActive ? 'active' : 'inactive'}.`,
            data,
        };
    }

    @Delete(':id')
    @RequirePermissions(PERMISSIONS.MANAGE_DEPARTMENT_MATERIALS)
    async remove(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        await this.stockSettingsService.delete(id, user.sub);
        return { message: 'Stock setting deleted.', data: null };
    }
}
