import { Injectable, Logger } from '@nestjs/common';
import { PrescriptionsRepository } from './prescriptions.repository';
import { Cron } from '@nestjs/schedule';
import { computeCycleEnd } from '../../common/utils/recurrence.util';

@Injectable()
export class PrescriptionCycleSchedulerService {
    private readonly logger = new Logger(
        PrescriptionCycleSchedulerService.name,
    );

    constructor(
        private readonly prescriptionsRepository: PrescriptionsRepository,
    ) {}

    @Cron(process.env.PRESCRIPTION_CYCLE_CHECK_CRON ?? '0 0 * * *')
    async handleCron() {
        const result = await this.runCheck();
        this.logger.log(
            `Prescription cycle check complete: ${result.advanced} advanced, ${result.completed} completed as missed.`,
        );
    }

    async runCheck(
        asOf: Date = new Date(),
    ): Promise<{ advanced: number; completed: number }> {
        const due = await this.prescriptionsRepository.findDueCycleChecks(asOf);

        let advanced = 0;
        let completed = 0;

        for (const prescription of due) {
            const isOneTime =
                !prescription.frequencyUnit || !prescription.frequencyInterval;
            const isFinalCycle =
                isOneTime ||
                (prescription.totalCycles !== null &&
                    prescription.currentCycleNumber >=
                        prescription.totalCycles);

            let nextCycleStart: Date | undefined;
            let nextCycleEnd: Date | undefined;

            if (!isFinalCycle) {
                nextCycleStart = new Date(prescription.currentCycleEnd);
                nextCycleEnd = computeCycleEnd(
                    nextCycleStart,
                    prescription.frequencyUnit,
                    prescription.frequencyInterval,
                );
            }

            await this.prescriptionsRepository.resolveMissedCycle({
                prescriptionId: prescription.id,
                patientId: prescription.patientId,
                cycleNumber: prescription.currentCycleNumber,
                periodStart: prescription.currentCycleStart,
                periodEnd: prescription.currentCycleEnd,
                isFinalCycle,
                nextCycleStart,
                nextCycleEnd,
                patientSnapshot: {
                    fullName: prescription.patient.fullName,
                    nationalId: prescription.patient.nationalId,
                    familyBookNumber: prescription.patient.familyBookNumber,
                },
                items: prescription.items.map((i) => ({
                    variantId: i.variantId,
                    prescribedQuantity: Number(i.prescribedQuantity),
                })),
            });

            if (isFinalCycle) completed++;
            else advanced++;
        }

        return { advanced, completed };
    }
}
