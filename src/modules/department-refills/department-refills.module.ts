import { Module } from '@nestjs/common';
import { RefillRequestsController } from './refill-requests/refill-requests.controller';
import { RefillRequestsService } from './refill-requests/refill-requests.service';
import { RefillRequestsRepository } from './refill-requests/refill-requests.repository';
import { RefillDeliveriesController } from './refill-deliveries/refill-deliveries.controller';
import { RefillDeliveriesService } from './refill-deliveries/refill-deliveries.service';
import { RefillDeliveriesRepository } from './refill-deliveries/refill-deliveries.repository';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],

  controllers: [RefillRequestsController, RefillDeliveriesController],
  providers: [
    RefillRequestsService,
    RefillRequestsRepository,
    RefillDeliveriesService,
    RefillDeliveriesRepository,
  ],
})
export class DepartmentRefillsModule {}
