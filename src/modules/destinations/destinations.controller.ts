import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { ListDestinationsDto } from './dto/list-destinations.dto';
import { DestinationsService } from './destinations.service';
import { RequirePermissions } from '../../core/decorators/require-permissions.decorator';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { PERMISSIONS } from '../../common/constants/permissions.constants';
import { UpdateDestinationDto } from './dto/update-destination.dto';
import { UpdateDestinationStatusDto } from './dto/update-destination-status.dto';

@Controller('destinations')
export class DestinationsController {
    constructor(private readonly destinationsService: DestinationsService) {}

    @Get()
    async findAll(@Query() query: ListDestinationsDto) {
        const data = await this.destinationsService.list(query);
        return { message: 'Success', data };
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const data = await this.destinationsService.findById(id);
        return { message: 'Success', data };
    }

    @Post()
    @RequirePermissions(PERMISSIONS.MANAGE_DESTINATIONS)
    async create(@Body() dto: CreateDestinationDto) {
        const data = await this.destinationsService.create(dto);
        return { message: 'تم إنشاء جهة الوجهة بنجاح.', data };
    }

    @Patch(':id')
    @RequirePermissions(PERMISSIONS.MANAGE_DESTINATIONS)
    async update(@Param('id') id: string, @Body() dto: UpdateDestinationDto) {
        const data = await this.destinationsService.update(id, dto);
        return { message: 'تم تحديث جهة الوجهة بنجاح.', data };
    }

    @Patch(':id/status')
    @RequirePermissions(PERMISSIONS.MANAGE_DESTINATIONS)
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateDestinationStatusDto,
    ) {
        const data = await this.destinationsService.updateStatus(id, dto);
        return {
            message: `تم تعيين جهة الوجهة كـ ${dto.isActive ? 'نشطة' : 'غير نشطة'}.`,
            data,
        };
    }
}
