import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { DepartmentsModule } from '../departments/departments.module';
import { DisposalSalesController } from './disposal-sales.controller';
import { DisposalSalesService } from './disposal-sales.service';
import { DisposalSalesRepository } from './disposal-sales.repository';

@Module({
    imports: [InventoryModule, DepartmentsModule],
    controllers: [DisposalSalesController],
    providers: [DisposalSalesService, DisposalSalesRepository],
})
export class DisposalSalesModule {}
