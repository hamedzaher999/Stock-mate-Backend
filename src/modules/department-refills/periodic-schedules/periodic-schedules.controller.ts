import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PeriodicSchedulesService } from './periodic-schedules.service';
import { ListPeriodicSchedulesDto } from './dto/list-periodic-schedules.dto';
import { CancelPeriodicScheduleDto } from './dto/cancel-periodic-schedule.dto';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('department-refills/periodic-schedules')
@RequirePermissions(PERMISSIONS.MANAGE_PERIODIC_REFILL_SCHEDULES)
export class PeriodicSchedulesController {
    constructor(
        private readonly periodicSchedulesService: PeriodicSchedulesService,
    ) {}

    @Get()
    async findAll(
        @Query() query: ListPeriodicSchedulesDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.periodicSchedulesService.list(query, user.sub);
        return { message: 'Success', data };
    }

    @Get(':id')
    async findOne(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.periodicSchedulesService.findById(id, user.sub);
        return { message: 'Success', data };
    }

    @Post(':id/cancel')
    async cancel(
        @Param('id') id: string,
        @Body() dto: CancelPeriodicScheduleDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.periodicSchedulesService.cancel(
            id,
            dto,
            user.sub,
        );
        return {
            message:
                'Recurring refill schedule cancelled. No further requests will be generated.',
            data,
        };
    }
}
