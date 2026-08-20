import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { DispensePrescriptionDto } from './dto/dispense-prescription.dto';
import { InsufficientStockError } from '../../../common/utils/fefo.util';
import { DispensingRepository } from './dispensing.repository';
import { DepartmentsCacheService } from '../../departments/departments-cache.service';
import {
    AlreadyProcessedError,
    CycleAllowanceExceededError,
} from '../../../common/utils/concurrency.util';
import { StockThresholdCheckService } from '../../inventory/stock-threshold-check.service';
const CLOSED_CYCLE_STATUSES = ['delivered', 'missed', 'cancelled'];

@Injectable()
export class DispensingService {
    constructor(
        private readonly dispensingRepository: DispensingRepository,
        private readonly departmentsCacheService: DepartmentsCacheService,
        private readonly stockThresholdCheckService: StockThresholdCheckService,
    ) {}

    async dispense(dto: DispensePrescriptionDto, dispensedById: string) {
        const prescription =
            await this.dispensingRepository.findPrescriptionForDispense(
                dto.prescriptionId,
            );
        if (!prescription)
            throw new NotFoundException('الوصفة الطبية غير موجودة.');
        if (prescription.status !== 'active') {
            throw new ConflictException('يمكن صرف الوصفات الطبية النشطة فقط.');
        }
        if (CLOSED_CYCLE_STATUSES.includes(prescription.currentCycleStatus)) {
            throw new ConflictException(
                'الدورة الحالية لهذه الوصفة الطبية ليست مخصصة للصرف.',
            );
        }

        const pharmacy =
            await this.departmentsCacheService.getByType('pharmacy');
        if (!pharmacy) {
            throw new BadRequestException(
                'لم يتم إعداد قسم الصيدلية -- لا يمكن إجراء الصرف.',
            );
        }

        const dispensedSoFar =
            await this.dispensingRepository.sumDispensedForCycle(
                dto.prescriptionId,
                prescription.currentCycleNumber,
            );

        const requestedItems: {
            prescriptionItemId: string;
            variantId: string;
            prescribedQuantity: number;
            quantity: number;
        }[] = [];

        for (const inputItem of dto.items) {
            const item = prescription.items.find(
                (i) => i.id === inputItem.prescriptionItemId,
            );
            if (!item) {
                throw new BadRequestException(
                    'عنصر واحد أو أكثر لا ينتمي إلى هذه الوصفة الطبية.',
                );
            }

            const alreadyThisCycle = dispensedSoFar.get(item.id) ?? 0;
            const remaining =
                Number(item.prescribedQuantity) - alreadyThisCycle;
            if (inputItem.quantity > remaining) {
                throw new BadRequestException(
                    `الكمية المصروفة تتجاوز المتبقي لهذه الدورة (المتبقي: ${remaining}).`,
                );
            }

            requestedItems.push({
                prescriptionItemId: item.id,
                variantId: item.variantId,
                prescribedQuantity: Number(item.prescribedQuantity),
                quantity: inputItem.quantity,
            });
        }

        const isOneTime =
            !prescription.frequencyUnit || !prescription.frequencyInterval;
        const isFinalCycle =
            isOneTime ||
            (prescription.totalCycles !== null &&
                prescription.currentCycleNumber >= prescription.totalCycles);

        try {
            const result = await this.dispensingRepository.dispense({
                prescriptionId: dto.prescriptionId,
                patientId: prescription.patientId,
                departmentId: pharmacy.id,
                cycleNumber: prescription.currentCycleNumber,
                dispensedById,
                notes: dto.notes,
                allItems: prescription.items.map((i) => ({
                    prescriptionItemId: i.id,
                    prescribedQuantity: Number(i.prescribedQuantity),
                })),
                requestedItems,
                isOneTime,
                isFinalCycle,
                frequencyUnit: prescription.frequencyUnit ?? undefined,
                frequencyInterval: prescription.frequencyInterval ?? undefined,
                nextCycleStart: new Date(prescription.currentCycleEnd),
                patientSnapshot: {
                    nationalId: prescription.patient.nationalId,
                    familyBookNumber: prescription.patient.familyBookNumber,
                    fullName: prescription.patient.fullName,
                },
            });

            await this.stockThresholdCheckService.checkAndNotifyMany(
                requestedItems.map((i) => ({
                    variantId: i.variantId,
                    departmentId: pharmacy.id,
                })),
            );

            return result;
        } catch (error) {
            if (error instanceof InsufficientStockError) {
                throw new BadRequestException(
                    'مخزون الصيدلية غير كافٍ لصرف الكمية المطلوبة.',
                );
            }
            if (error instanceof AlreadyProcessedError) {
                throw new ConflictException(error.message);
            }
            if (error instanceof CycleAllowanceExceededError) {
                throw new ConflictException(
                    'الكمية المتبقية المسموحة لهذه الدورة تغيرت قبل اكتمال هذا الطلب (يُحتمل وجود عملية صرف متزامنة) -- يرجى تحديث الصفحة والمحاولة مرة أخرى.',
                );
            }
            throw error;
        }
    }
}
