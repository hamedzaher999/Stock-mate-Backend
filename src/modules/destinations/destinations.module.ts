import { Module } from '@nestjs/common';
import { DestinationsController } from './destinations.controller';
import { DestinationsService } from './destinations.service';
import { DestinationsRepository } from './destinations.repository';

@Module({
    controllers: [DestinationsController],
    providers: [DestinationsService, DestinationsRepository],
    exports: [DestinationsRepository],
})
export class DestinationsModule {}
