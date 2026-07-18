import { Module } from '@nestjs/common';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { BatchesRepository } from './batches.repository';

@Module({
    controllers: [BatchesController],
    providers: [BatchesService, BatchesRepository],
    exports: [BatchesRepository],
})
export class BatchesModule {}
