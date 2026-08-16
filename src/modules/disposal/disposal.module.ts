import { Module } from '@nestjs/common';
import { DisposalController } from './disposal.controller';
import { DisposalService } from './disposal.service';
import { DisposalRepository } from './disposal.repository';
import { RbacModule } from '../rbac/rbac.module';
import { DepartmentsModule } from '../departments/departments.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
    imports: [RbacModule, DepartmentsModule, InventoryModule],
    controllers: [DisposalController],
    providers: [DisposalService, DisposalRepository],
})
export class DisposalModule {}
