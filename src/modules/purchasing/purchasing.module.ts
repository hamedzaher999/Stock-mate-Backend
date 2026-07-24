import { Module } from '@nestjs/common';
import { PurchaseRequestsController } from './purchase-requests/purchase-requests.controller';
import { PurchaseRequestsService } from './purchase-requests/purchase-requests.service';
import { PurchaseRequestsRepository } from './purchase-requests/purchase-requests.repository';
import { PurchaseReceivingController } from './purchase-receiving/purchase-receiving.controller';
import { PurchaseReceivingService } from './purchase-receiving/purchase-receiving.service';
import { PurchaseReceivingRepository } from './purchase-receiving/purchase-receiving.repository';
import { InventoryModule } from '../inventory/inventory.module';
import { DepartmentsModule } from '../departments/departments.module';
import { RbacModule } from '../rbac/rbac.module';
@Module({
    imports: [InventoryModule, DepartmentsModule, RbacModule],
    controllers: [PurchaseRequestsController, PurchaseReceivingController],
    providers: [
        PurchaseRequestsService,
        PurchaseRequestsRepository,
        PurchaseReceivingService,
        PurchaseReceivingRepository,
    ],
})
export class PurchasingModule {}
