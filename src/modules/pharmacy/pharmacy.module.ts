import { Module } from '@nestjs/common';
import { DispenseQueueController } from './dispense-queue/dispense-queue.controller';
import { DispenseQueueService } from './dispense-queue/dispense-queue.service';
import { DispenseQueueRepository } from './dispense-queue/dispense-queue.repository';
import { DispensingController } from './dispensing/dispensing.controller';
import { DispensingService } from './dispensing/dispensing.service';
import { DispensingRepository } from './dispensing/dispensing.repository';
import { InventoryModule } from '../inventory/inventory.module';
import { DepartmentsModule } from '../departments/departments.module';

@Module({
    imports: [InventoryModule, DepartmentsModule],
    controllers: [DispenseQueueController, DispensingController],
    providers: [
        DispenseQueueService,
        DispenseQueueRepository,
        DispensingService,
        DispensingRepository,
    ],
    exports: [DispenseQueueRepository],
})
export class PharmacyModule {}
