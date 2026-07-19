import { Module } from '@nestjs/common';
import { MedicalVisitsController } from './medical-visits.controller';
import { MedicalVisitsService } from './medical-visits.service';
import { MedicalVisitsRepository } from './medical-visits.repository';
import { PatientsModule } from '../patients/patients.module';
import { DepartmentQueueModule } from '../department-queue/department-queue.module';
import { PharmacyModule } from '../pharmacy/pharmacy.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
    imports: [
        RbacModule,
        PatientsModule,
        DepartmentQueueModule,
        PharmacyModule,
    ],
    controllers: [MedicalVisitsController],
    providers: [MedicalVisitsService, MedicalVisitsRepository],
    exports: [MedicalVisitsRepository],
})
export class MedicalVisitsModule {}
