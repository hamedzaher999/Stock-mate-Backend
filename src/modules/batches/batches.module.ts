import { Module } from '@nestjs/common';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { BatchesRepository } from './batches.repository';
import { RbacModule } from '../rbac/rbac.module';

@Module({
    imports: [RbacModule],
    controllers: [BatchesController],
    providers: [BatchesService, BatchesRepository],
    exports: [BatchesRepository],
})
export class BatchesModule {}
