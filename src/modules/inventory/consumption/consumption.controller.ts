import { Body, Controller, Post } from '@nestjs/common';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { ConsumptionService } from './consumption.service';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { CreateConsumptionDto } from './dto/create-consumption.dto';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('inventory/consumption')
export class ConsumptionController {
    constructor(private readonly consumptionService: ConsumptionService) {}

    @Post()
    @RequirePermissions(PERMISSIONS.RECORD_DEPARTMENT_CONSUMPTION)
    async create(
        @Body() dto: CreateConsumptionDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.consumptionService.create(dto, user.sub);
        return { message: 'Consumption recorded.', data };
    }
}
