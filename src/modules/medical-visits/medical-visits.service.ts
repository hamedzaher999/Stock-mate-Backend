import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { MedicalVisitsRepository } from './medical-visits.repository';
import { PatientsRepository } from '../patients/patients.repository';
import { DepartmentQueueRepository } from '../department-queue/department-queue.repository';
import { SelectPatientDto } from './dto/select-patient.dto';
import { CompleteConsultationDto } from './dto/complete-consultation.dto';
import { CancelVisitDto } from './dto/cancel-visit.dto';
import { ListMedicalVisitsDto } from './dto/list-medical-visits.dto';
import { PaginatedResult } from '../../core/interfaces/paginated-result.interface';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../common/constants/roles.constants';
import { PermissionsResolverService } from '../rbac/permissions-resolver.service';
import { PERMISSIONS } from '../../common/constants/permissions.constants';
import { UserScopeService } from '../rbac/user-scope.service';

@Injectable()
export class MedicalVisitsService {
    constructor(
        private readonly medicalVisitsRepository: MedicalVisitsRepository,
        private readonly patientsRepository: PatientsRepository,
        private readonly departmentQueueRepository: DepartmentQueueRepository,
        private readonly permissionsResolver: PermissionsResolverService,
        private readonly userScopeService: UserScopeService,
    ) {}

    async list(
        dto: ListMedicalVisitsDto,
        requestingUserId: string,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } = await this.medicalVisitsRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            patientId: dto.patientId,
            doctorId: dto.doctorId,
            departmentId: dto.departmentId,
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
        const visit = await this.medicalVisitsRepository.findById(id);
        if (!visit) throw new NotFoundException('Medical visit not found.');
        return visit;
    }

    async getPatientHistory(patientId: string) {
        const patient = await this.patientsRepository.findById(patientId);
        if (!patient) throw new NotFoundException('Patient not found.');

        const visits =
            await this.medicalVisitsRepository.findAllForPatient(patientId);

        const departmentsMap = new Map<
            string,
            {
                id: string;
                name: string;
                visits: {
                    id: string;
                    visitDate: Date;
                    status: string;
                    clinicalNotes: string | null;
                    diagnosis: string | null;
                    externalMedications: string | null;
                    cancelReason: string | null;
                    doctor: {
                        id: string;
                        fullName: string;
                        specialty: string | null;
                    };
                }[];
            }
        >();

        for (const visit of visits) {
            if (!departmentsMap.has(visit.departmentId)) {
                departmentsMap.set(visit.departmentId, {
                    id: visit.department.id,
                    name: visit.department.name,
                    visits: [],
                });
            }

            departmentsMap.get(visit.departmentId)!.visits.push({
                id: visit.id,
                visitDate: visit.visitDate,
                status: visit.status,
                clinicalNotes: visit.clinicalNotes,
                diagnosis: visit.diagnosis,
                externalMedications: visit.externalMedications,
                cancelReason: visit.cancelReason,
                doctor: {
                    id: visit.doctor.id,
                    fullName: visit.doctor.fullName,
                    specialty: visit.doctor.specialty,
                },
            });
        }

        const departments = Array.from(departmentsMap.values());

        return {
            patient: {
                id: patient.id,
                fullName: patient.fullName,
                nationalId: patient.nationalId,
                patientId: patient.patientId,
            },
            departments,
        };
    }

    async selectPatient(dto: SelectPatientDto, doctorId: string) {
        const entry = await this.departmentQueueRepository.findById(
            dto.queueEntryId,
        );
        if (!entry)
            throw new BadRequestException('Queue entry does not exist.');
        if (entry.status !== 'waiting') {
            throw new ConflictException(
                'Only a patient currently waiting can be selected.',
            );
        }

        const scope = await this.userScopeService.getUserScope(doctorId);
        if (
            scope?.roleName !== HOSPITAL_MANAGER_ROLE_NAME &&
            scope?.departmentId !== entry.departmentId
        ) {
            throw new ForbiddenException(
                'You can only select patients in your own department.',
            );
        }

        return this.departmentQueueRepository.lock(entry.id, doctorId);
    }

    async completeConsultation(dto: CompleteConsultationDto, doctorId: string) {
        const entry = await this.departmentQueueRepository.findById(
            dto.queueEntryId,
        );
        if (!entry)
            throw new BadRequestException('Queue entry does not exist.');
        if (entry.status !== 'in_consultation') {
            throw new ConflictException(
                'Only a selected (in-consultation) patient can be completed.',
            );
        }

        const scope = await this.userScopeService.getUserScope(doctorId);
        if (
            entry.lockedById !== doctorId &&
            scope?.roleName !== HOSPITAL_MANAGER_ROLE_NAME
        ) {
            throw new ForbiddenException(
                'Only the doctor who selected this patient can complete the consultation.',
            );
        }

        return this.medicalVisitsRepository.createCompletedVisit({
            patientId: entry.patientId,
            doctorId,
            departmentId: entry.departmentId,
            queueEntryId: entry.id,
            clinicalNotes: dto.clinicalNotes,
            diagnosis: dto.diagnosis,
            externalMedications: dto.externalMedications,
            prescriptions: dto.prescriptions?.map((rx) => ({
                frequencyUnit: rx.frequencyUnit,
                frequencyInterval: rx.frequencyInterval,
                totalCycles: rx.totalCycles,
                startDate: new Date(rx.startDate),
                items: rx.items,
            })),
        });
    }

    async cancel(id: string, dto: CancelVisitDto, requestingUserId: string) {
        const visit = await this.findById(id);
        if (visit.status !== 'completed') {
            throw new ConflictException(
                'Only a completed visit can be cancelled.',
            );
        }

        const isOwner = visit.doctorId === requestingUserId;
        if (!isOwner) {
            const permissions =
                await this.permissionsResolver.getEffectivePermissions(
                    requestingUserId,
                );
            if (!permissions.has(PERMISSIONS.CANCEL_VISIT)) {
                throw new ForbiddenException(
                    'Only the doctor who documented this visit, or a user with visit-cancellation permission, can cancel it.',
                );
            }
        }

        return this.medicalVisitsRepository.cancel({
            visitId: id,
            reason: dto.reason,
            cancelledById: requestingUserId,
        });
    }
}
