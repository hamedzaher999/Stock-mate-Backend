import { Module } from '@nestjs/common';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { BatchesRepository } from './batches.repository';
import { RbacModule } from '../rbac/rbac.module';
import { ExpirationMonitorService } from './expiration-monitor.service';
import { ExpirationMonitorRepository } from './expiration-monitor.repository';
@Module({
    imports: [RbacModule],
    controllers: [BatchesController],
    providers: [
        BatchesService,
        BatchesRepository,
        ExpirationMonitorService,
        ExpirationMonitorRepository,
    ],
    exports: [BatchesRepository],
})
export class BatchesModule {}
