import { Controller, Get, Query } from '@nestjs/common';
import { DispenseQueueService } from './dispense-queue.service';
import { ListDispenseQueueDto } from './dto/list-dispense-queue.dto';
import { LookupDispenseQueueDto } from './dto/lookup-dispense-queue.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('pharmacy/dispense-queue')
@RequirePermissions(PERMISSIONS.DISPENSE_PRESCRIPTION)
export class DispenseQueueController {
    constructor(private readonly dispenseQueueService: DispenseQueueService) {}

    @Get()
    async findAll(@Query() query: ListDispenseQueueDto) {
        const data = await this.dispenseQueueService.list(query);
        return { message: 'Success', data };
    }

    @Get('lookup')
    async lookup(@Query() query: LookupDispenseQueueDto) {
        const data = await this.dispenseQueueService.lookup(query);
        return { message: 'Success', data };
    }
}
