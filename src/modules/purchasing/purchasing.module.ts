import { Module } from '@nestjs/common';
import { PurchaseRequestsController } from './purchase-requests/purchase-requests.controller';
import { PurchaseRequestsService } from './purchase-requests/purchase-requests.service';
import { PurchaseRequestsRepository } from './purchase-requests/purchase-requests.repository';
import { PurchaseOrdersController } from './purchase-orders/purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders/purchase-orders.service';
import { PurchaseOrdersRepository } from './purchase-orders/purchase-orders.repository';
import { PurchaseReceivingController } from './purchase-receiving/purchase-receiving.controller';
import { PurchaseReceivingService } from './purchase-receiving/purchase-receiving.service';
import { PurchaseReceivingRepository } from './purchase-receiving/purchase-receiving.repository';

@Module({
  controllers: [
    PurchaseRequestsController,
    PurchaseOrdersController,
    PurchaseReceivingController,
  ],
  providers: [
    PurchaseRequestsService,
    PurchaseRequestsRepository,
    PurchaseOrdersService,
    PurchaseOrdersRepository,
    PurchaseReceivingService,
    PurchaseReceivingRepository,
  ],
})
export class PurchasingModule {}
