import { Module } from '@nestjs/common';
import { DepartmentQueueController } from './department-queue.controller';
import { DepartmentQueueService } from './department-queue.service';
import { DepartmentQueueRepository } from './department-queue.repository';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [DepartmentQueueController],
  providers: [DepartmentQueueService, DepartmentQueueRepository],
  exports: [DepartmentQueueRepository],
})
export class DepartmentQueueModule {}
