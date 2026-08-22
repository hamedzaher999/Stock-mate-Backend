import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { InventoryMovementReportController } from './inventory-movement/inventory-movement.controller';
import { InventoryMovementReportService } from './inventory-movement/inventory-movement.service';
import { InventoryMovementRepository } from './inventory-movement/inventory-movement.repository';
import { AdjustmentsReportController } from './adjustments-report/adjustments-report.controller';
import { AdjustmentsReportService } from './adjustments-report/adjustments-report.service';
import { AdjustmentsReportRepository } from './adjustments-report/adjustments-report.repository';
import { PatientVisitsReportController } from './patient-visits-report/patient-visits-report.controller';
import { PatientVisitsReportService } from './patient-visits-report/patient-visits-report.service';
import { PatientVisitsReportRepository } from './patient-visits-report/patient-visits-report.repository';
import { ExcelExportService } from './common/excel-export.service';
import { ReportAccessService } from './common/report-access.service';
import { ReportsCacheService } from './common/reports-cache.service';

@Module({
    imports: [RbacModule],
    controllers: [
        InventoryMovementReportController,
        AdjustmentsReportController,
        PatientVisitsReportController,
    ],
    providers: [
        InventoryMovementReportService,
        InventoryMovementRepository,
        AdjustmentsReportService,
        AdjustmentsReportRepository,
        PatientVisitsReportService,
        PatientVisitsReportRepository,
        ExcelExportService,
        ReportAccessService,
        ReportsCacheService,
    ],
})
export class ReportsModule {}
