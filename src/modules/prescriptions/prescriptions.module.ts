import { Module } from '@nestjs/common';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionsRepository } from './prescriptions.repository';
import { RbacModule } from '../rbac/rbac.module';
import { PharmacyModule } from '../pharmacy/pharmacy.module';
import { PrescriptionCycleSchedulerService } from './prescription-cycle-scheduler.service';

@Module({
    imports: [RbacModule, PharmacyModule],
    controllers: [PrescriptionsController],
    providers: [
        PrescriptionsService,
        PrescriptionsRepository,
        PrescriptionCycleSchedulerService,
    ],
    exports: [PrescriptionsRepository],
})
export class PrescriptionsModule {}
