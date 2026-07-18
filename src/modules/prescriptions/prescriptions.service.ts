import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrescriptionsRepository } from './prescriptions.repository';
import { CancelPrescriptionDto } from './dto/cancel-prescription.dto';
import { RenewPrescriptionDto } from './dto/renew-prescription.dto';
import { ListPrescriptionsDto } from './dto/list-prescriptions.dto';
import { PaginatedResult } from '../../core/interfaces/paginated-result.interface';
import { PermissionsResolverService } from '../rbac/permissions-resolver.service';
import { PERMISSIONS } from '../../common/constants/permissions.constants';
import { computeCycleEnd } from '../../common/utils/prescription-cycle.util';

@Injectable()
export class PrescriptionsService {
    constructor(
        private readonly prescriptionsRepository: PrescriptionsRepository,
        private readonly permissionsResolver: PermissionsResolverService,
    ) {}

    async list(dto: ListPrescriptionsDto): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } = await this.prescriptionsRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            patientId: dto.patientId,
            doctorId: dto.doctorId,
            status: dto.status,
        });

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findById(id: string) {
        const prescription = await this.prescriptionsRepository.findById(id);
        if (!prescription)
            throw new NotFoundException('Prescription not found.');
        return prescription;
    }

    async cancel(
        id: string,
        dto: CancelPrescriptionDto,
        requestingUserId: string,
    ) {
        const prescription = await this.findById(id);
        if (prescription.status !== 'active') {
            throw new ConflictException(
                'Only an active prescription can be cancelled.',
            );
        }

        await this.assertCanManage(prescription.doctorId, requestingUserId);

        return this.prescriptionsRepository.cancel({
            prescriptionId: id,
            reason: dto.reason,
            cancelledById: requestingUserId,
        });
    }

    async renew(id: string, dto: RenewPrescriptionDto, doctorId: string) {
        const oldPrescription = await this.findById(id);
        if (oldPrescription.status !== 'active') {
            throw new ConflictException(
                'Only an active prescription can be renewed.',
            );
        }

        await this.assertCanManage(oldPrescription.doctorId, doctorId);

        const visit = await this.prescriptionsRepository.findVisit(dto.visitId);
        if (!visit) throw new BadRequestException('Visit does not exist.');
        if (visit.status !== 'completed') {
            throw new BadRequestException(
                'The visit must be completed before a prescription can be renewed against it.',
            );
        }
        if (visit.patientId !== oldPrescription.patientId) {
            throw new BadRequestException(
                "The visit provided does not belong to this prescription's patient.",
            );
        }
        if (visit.doctorId !== doctorId) {
            throw new ForbiddenException(
                'The renewal must be issued from a consultation you conducted yourself.',
            );
        }

        const startDate = new Date(dto.startDate);
        const currentCycleEnd = computeCycleEnd(
            startDate,
            dto.frequencyUnit,
            dto.frequencyInterval,
        );

        return this.prescriptionsRepository.renew({
            oldPrescriptionId: id,
            visitId: dto.visitId,
            patientId: oldPrescription.patientId,
            doctorId,
            frequencyUnit: dto.frequencyUnit,
            frequencyInterval: dto.frequencyInterval,
            totalCycles: dto.totalCycles,
            startDate,
            currentCycleEnd,
            items: dto.items,
        });
    }

    private async assertCanManage(
        prescriptionDoctorId: string,
        requestingUserId: string,
    ) {
        if (prescriptionDoctorId === requestingUserId) return;

        const permissions =
            await this.permissionsResolver.getEffectivePermissions(
                requestingUserId,
            );
        if (permissions.has(PERMISSIONS.MANAGE_ALL_PRESCRIPTIONS)) return;

        throw new ForbiddenException(
            'You can only renew or cancel prescriptions you wrote yourself.',
        );
    }
}
