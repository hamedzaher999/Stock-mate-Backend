import { Module } from '@nestjs/common';
import { StockSettingsController } from './stock-settings.controller';
import { StockSettingsService } from './stock-settings.service';
import { StockSettingsRepository } from './stock-settings.repository';
import { StockThresholdSchedulerService } from './stock-threshold-scheduler.service';
import { DepartmentsModule } from '../departments/departments.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
    imports: [RbacModule, DepartmentsModule],
    controllers: [StockSettingsController],
    providers: [
        StockSettingsService,
        StockSettingsRepository,
        StockThresholdSchedulerService,
    ],
    exports: [StockSettingsRepository],
})
export class StockSettingsModule {}
