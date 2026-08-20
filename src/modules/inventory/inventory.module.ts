import { Module } from '@nestjs/common';
import { DepartmentInventoryController } from './department-inventory/department-inventory.controller';
import { DepartmentInventoryService } from './department-inventory/department-inventory.service';
import { DepartmentInventoryRepository } from './department-inventory/department-inventory.repository';
import { AdjustmentsController } from './adjustments/adjustments.controller';
import { AdjustmentsService } from './adjustments/adjustments.service';
import { AdjustmentsRepository } from './adjustments/adjustments.repository';
import { TransactionsController } from './transactions/transactions.controller';
import { TransactionsService } from './transactions/transactions.service';
import { TransactionsRepository } from './transactions/transactions.repository';
import { StockCountsController } from './stock-counts/stock-counts.controller';
import { StockCountsService } from './stock-counts/stock-counts.service';
import { StockCountsRepository } from './stock-counts/stock-counts.repository';
import { InventoryLedgerService } from './transactions/inventory-ledger.service';
import { ConsumptionController } from './consumption/consumption.controller';
import { ConsumptionService } from './consumption/consumption.service';
import { ConsumptionRepository } from './consumption/consumption.repository';
import { RbacModule } from '../rbac/rbac.module';
import { DepartmentsModule } from '../departments/departments.module';
import { StockThresholdCheckService } from './stock-threshold-check.service';
import { StockSettingsModule } from '../stock-settings/stock-settings.module';
@Module({
    imports: [RbacModule, DepartmentsModule, StockSettingsModule],
    controllers: [
        DepartmentInventoryController,
        AdjustmentsController,
        TransactionsController,
        StockCountsController,
        ConsumptionController,
    ],
    providers: [
        DepartmentInventoryService,
        DepartmentInventoryRepository,
        AdjustmentsService,
        AdjustmentsRepository,
        TransactionsService,
        TransactionsRepository,
        StockCountsService,
        StockCountsRepository,
        InventoryLedgerService,
        ConsumptionService,
        ConsumptionRepository,
        StockThresholdCheckService,
    ],
    exports: [
        InventoryLedgerService,
        DepartmentInventoryService,
        StockThresholdCheckService,
    ],
})
export class InventoryModule {}
