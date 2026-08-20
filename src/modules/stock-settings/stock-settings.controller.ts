import { RequireAnyPermissions } from '../../core/decorators/require-any-permissions.decorator';
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
    @RequireAnyPermissions(
        PERMISSIONS.VIEW_INVENTORY,
        PERMISSIONS.MANAGE_DEPARTMENT_MATERIALS,
    )
    async findAll(
        @Query() query: ListStockSettingsDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.stockSettingsService.list(query, user.sub);
        return { message: 'Success', data };
    }

    @Get(':id')
    @RequirePermissions(PERMISSIONS.VIEW_INVENTORY)
    async findOne(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.stockSettingsService.findById(id, user.sub);
        return { message: 'Success', data };
    }

    @Post()
    @RequirePermissions(PERMISSIONS.MANAGE_DEPARTMENT_MATERIALS)
    async create(
        @Body() dto: CreateStockSettingDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.stockSettingsService.create(dto, user.sub);
        return {
            message: `${data.created} stock setting(s) created, ${data.failed} failed.`,
            data,
        };
    }

    @Patch(':id')
    @RequirePermissions(PERMISSIONS.MANAGE_DEPARTMENT_MATERIALS)
    async update(@Param('id') id: string, @Body() dto: UpdateStockSettingDto) {
        const data = await this.stockSettingsService.update(id, dto);
        return { message: 'تم تحديث إعداد المخزون بنجاح.', data };
    }

    @Patch(':id/status')
    @RequirePermissions(PERMISSIONS.MANAGE_DEPARTMENT_MATERIALS)
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateStockSettingStatusDto,
    ) {
        const data = await this.stockSettingsService.updateStatus(id, dto);
        return {
            message: `تم تعيين إعداد المخزون كـ ${dto.isActive ? 'نشط' : 'غير نشط'}.`,
            data,
        };
    }

    @Delete(':id')
    @RequirePermissions(PERMISSIONS.MANAGE_DEPARTMENT_MATERIALS)
    async remove(@Param('id') id: string) {
        await this.stockSettingsService.delete(id);
        return { message: 'تم حذف إعداد المخزون بنجاح.', data: null };
    }
}
