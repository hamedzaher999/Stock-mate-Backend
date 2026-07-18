import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { DispensePrescriptionDto } from './dto/dispense-prescription.dto';
import { InsufficientStockError } from '../../../common/utils/fefo.util';
import { computeCycleEnd } from '../../../common/utils/prescription-cycle.util';
import { DispensingRepository, CycleResolution } from './dispensing.repository';
const CLOSED_CYCLE_STATUSES = ['delivered', 'missed', 'cancelled'];

@Injectable()
export class DispensingService {
    constructor(private readonly dispensingRepository: DispensingRepository) {}

    async dispense(dto: DispensePrescriptionDto, dispensedById: string) {
        const prescription =
            await this.dispensingRepository.findPrescriptionForDispense(
                dto.prescriptionId,
            );
        if (!prescription)
            throw new NotFoundException('Prescription not found.');
        if (prescription.status !== 'active') {
            throw new ConflictException(
                'Only an active prescription can be dispensed.',
            );
        }
        if (CLOSED_CYCLE_STATUSES.includes(prescription.currentCycleStatus)) {
            throw new ConflictException(
                'The current cycle for this prescription is not open for dispensing.',
            );
        }

        const pharmacy =
            await this.dispensingRepository.findPharmacyDepartment();
        if (!pharmacy) {
            throw new BadRequestException(
                'No Pharmacy department is configured -- cannot dispense.',
            );
        }

        const dispensedSoFar =
            await this.dispensingRepository.sumDispensedForCycle(
                dto.prescriptionId,
                prescription.currentCycleNumber,
            );

        const lines: {
            prescriptionItemId: string;
            variantId: string;
            quantity: number;
        }[] = [];

        for (const inputItem of dto.items) {
            const item = prescription.items.find(
                (i) => i.id === inputItem.prescriptionItemId,
            );
            if (!item) {
                throw new BadRequestException(
                    'One or more items do not belong to this prescription.',
                );
            }

            const alreadyThisCycle = dispensedSoFar.get(item.id) ?? 0;
            const remaining =
                Number(item.prescribedQuantity) - alreadyThisCycle;
            if (inputItem.quantity > remaining) {
                throw new BadRequestException(
                    `Dispensed quantity exceeds what remains for this cycle (remaining: ${remaining}).`,
                );
            }

            lines.push({
                prescriptionItemId: item.id,
                variantId: item.variantId,
                quantity: inputItem.quantity,
            });
        }

        const willBeFullyDelivered = prescription.items.every((item) => {
            const already = dispensedSoFar.get(item.id) ?? 0;
            const thisDispense =
                lines.find((l) => l.prescriptionItemId === item.id)?.quantity ??
                0;
            return already + thisDispense >= Number(item.prescribedQuantity);
        });

        let cycleResolution: CycleResolution;

        if (!willBeFullyDelivered) {
            cycleResolution = { type: 'partial' };
        } else {
            const isOneTime =
                !prescription.frequencyUnit || !prescription.frequencyInterval;
            const isFinalCycle =
                isOneTime ||
                (prescription.totalCycles !== null &&
                    prescription.currentCycleNumber >=
                        prescription.totalCycles);

            if (isFinalCycle) {
                cycleResolution = {
                    type: 'resolved_final',
                    resolvedAt: new Date(),
                };
            } else {
                const nextCycleNumber = prescription.currentCycleNumber + 1;
                const nextCycleStart = new Date(prescription.currentCycleEnd);
                const nextCycleEnd = computeCycleEnd(
                    nextCycleStart,
                    prescription.frequencyUnit,
                    prescription.frequencyInterval,
                );
                cycleResolution = {
                    type: 'resolved_advance',
                    resolvedAt: new Date(),
                    nextCycleNumber,
                    nextCycleStart,
                    nextCycleEnd,
                };
            }
        }

        try {
            return await this.dispensingRepository.dispense({
                prescriptionId: dto.prescriptionId,
                patientId: prescription.patientId,
                departmentId: pharmacy.id,
                cycleNumber: prescription.currentCycleNumber,
                dispensedById,
                notes: dto.notes,
                lines,
                cycleResolution,
                patientSnapshot: {
                    nationalId: prescription.patient.nationalId,
                    familyBookNumber: prescription.patient.familyBookNumber,
                    fullName: prescription.patient.fullName,
                },
            });
        } catch (error) {
            if (error instanceof InsufficientStockError) {
                throw new BadRequestException(
                    'Insufficient Pharmacy stock to dispense the requested quantity.',
                );
            }
            throw error;
        }
    }
}
