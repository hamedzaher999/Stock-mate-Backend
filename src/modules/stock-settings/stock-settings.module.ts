import { Module } from '@nestjs/common';
import { StockSettingsController } from './stock-settings.controller';
import { StockSettingsService } from './stock-settings.service';
import { StockSettingsRepository } from './stock-settings.repository';

@Module({
  controllers: [StockSettingsController],
  providers: [StockSettingsService, StockSettingsRepository],
  exports: [StockSettingsRepository],
})
export class StockSettingsModule {}
