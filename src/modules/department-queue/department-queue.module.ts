import { Module } from '@nestjs/common';
import { DepartmentQueueController } from './department-queue.controller';
import { DepartmentQueueService } from './department-queue.service';
import { DepartmentQueueRepository } from './department-queue.repository';
import { RbacModule } from '../rbac/rbac.module';
import { QueueWaitSchedulerService } from './queue-wait-scheduler.service';
import { DepartmentsModule } from '../departments/departments.module';

@Module({
    imports: [RbacModule, DepartmentsModule],
    controllers: [DepartmentQueueController],
    providers: [
        DepartmentQueueService,
        DepartmentQueueRepository,
        QueueWaitSchedulerService,
    ],
    exports: [DepartmentQueueRepository],
})
export class DepartmentQueueModule {}
