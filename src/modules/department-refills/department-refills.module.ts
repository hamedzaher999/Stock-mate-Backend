import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { RefillRequestsController } from './refill-requests/refill-requests.controller';
import { RefillRequestsService } from './refill-requests/refill-requests.service';
import { RefillRequestsRepository } from './refill-requests/refill-requests.repository';
import { RefillDeliveriesController } from './refill-deliveries/refill-deliveries.controller';
import { RefillDeliveriesService } from './refill-deliveries/refill-deliveries.service';
import { RefillDeliveriesRepository } from './refill-deliveries/refill-deliveries.repository';
import { PeriodicSchedulesController } from './periodic-schedules/periodic-schedules.controller';
import { PeriodicSchedulesService } from './periodic-schedules/periodic-schedules.service';
import { PeriodicSchedulesRepository } from './periodic-schedules/periodic-schedules.repository';
import { ScheduleGenerationService } from './periodic-schedules/schedule-generation.service';

@Module({
    imports: [InventoryModule],
    controllers: [
        RefillRequestsController,
        RefillDeliveriesController,
        PeriodicSchedulesController,
    ],
    providers: [
        RefillRequestsService,
        RefillRequestsRepository,
        RefillDeliveriesService,
        RefillDeliveriesRepository,
        PeriodicSchedulesService,
        PeriodicSchedulesRepository,
        ScheduleGenerationService,
    ],
})
export class DepartmentRefillsModule {}
