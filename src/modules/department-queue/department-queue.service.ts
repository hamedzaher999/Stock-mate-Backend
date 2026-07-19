import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { DepartmentQueueRepository } from './department-queue.repository';
import { PermissionsResolverService } from '../rbac/permissions-resolver.service';
import { CreateQueueEntryDto } from './dto/create-queue-entry.dto';
import { ReleaseQueueEntryDto } from './dto/release-queue-entry.dto';
import { RemoveQueueEntryDto } from './dto/remove-queue-entry.dto';
import { ListQueueDto } from './dto/list-queue.dto';
import { PaginatedResult } from '../../core/interfaces/paginated-result.interface';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../common/constants/roles.constants';
import { PERMISSIONS } from '../../common/constants/permissions.constants';

const UNRESTRICTED_ROLES = [HOSPITAL_MANAGER_ROLE_NAME, 'reception_staff'];
const QUEUEABLE_DEPARTMENT_TYPE = 'standard';

@Injectable()
export class DepartmentQueueService {
    constructor(
        private readonly departmentQueueRepository: DepartmentQueueRepository,
        private readonly permissionsResolver: PermissionsResolverService,
    ) {}

    async list(
        dto: ListQueueDto,
        requestingUserId: string,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const scope = await this.resolveDepartmentScope(requestingUserId);
        const departmentId = scope ?? dto.departmentId;
        if (!departmentId) {
            throw new BadRequestException('departmentId is required.');
        }
        if (scope && dto.departmentId && dto.departmentId !== scope) {
            throw new ForbiddenException(
                'You can only view the queue for your own department.',
            );
        }

        const { items, total } = await this.departmentQueueRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            departmentId,
            status: dto.status,
            search: dto.search,
        });

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findById(id: string, requestingUserId: string) {
        const entry = await this.departmentQueueRepository.findById(id);
        if (!entry) throw new NotFoundException('Queue entry not found.');

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && entry.departmentId !== scope) {
            throw new ForbiddenException(
                'You can only view queue entries for your own department.',
            );
        }

        return entry;
    }

    async create(dto: CreateQueueEntryDto, addedById: string) {
        const scope = await this.resolveDepartmentScope(addedById);
        if (scope && dto.departmentId !== scope) {
            throw new ForbiddenException(
                "You can only add patients to your own department's queue.",
            );
        }

        const department =
            await this.departmentQueueRepository.findDepartmentType(
                dto.departmentId,
            );
        if (!department)
            throw new BadRequestException('Department does not exist.');
        if (!department.isActive)
            throw new BadRequestException('Department is inactive.');
        if (department.type !== QUEUEABLE_DEPARTMENT_TYPE) {
            throw new BadRequestException(
                'Patients can only be queued at clinical (standard) departments.',
            );
        }
        if (!department.hasQueue) {
            throw new BadRequestException(
                'This department does not have a patient queue enabled.',
            );
        }

        const patient = await this.departmentQueueRepository.patientExists(
            dto.patientId,
        );
        if (!patient) throw new BadRequestException('Patient does not exist.');

        const alreadyInQueue =
            await this.departmentQueueRepository.findActiveEntryForPatientInDepartment(
                dto.patientId,
                dto.departmentId,
            );
        if (alreadyInQueue) {
            throw new ConflictException(
                'This patient already has an active queue entry in this department.',
            );
        }

        return this.departmentQueueRepository.create({
            departmentId: dto.departmentId,
            patientId: dto.patientId,
            addedById,
        });
    }

    async lock(id: string, doctorId: string) {
        const entry = await this.findById(id, doctorId);
        if (entry.status !== 'waiting') {
            throw new ConflictException(
                'Only patients currently waiting can be locked for consultation.',
            );
        }

        const requesterContext =
            await this.departmentQueueRepository.findRequestingUserContext(
                doctorId,
            );
        if (
            requesterContext?.role.name !== HOSPITAL_MANAGER_ROLE_NAME &&
            requesterContext?.departmentId !== entry.departmentId
        ) {
            throw new ForbiddenException(
                'You can only lock patients in your own department.',
            );
        }

        return this.departmentQueueRepository.lock(id, doctorId);
    }

    async release(
        id: string,
        dto: ReleaseQueueEntryDto,
        requestingUserId: string,
    ) {
        const entry = await this.findById(id, requestingUserId);
        if (entry.status !== 'in_consultation') {
            throw new ConflictException(
                'Only a locked (in-consultation) entry can be released.',
            );
        }

        const isOriginalLocker = entry.lockedById === requestingUserId;
        if (!isOriginalLocker) {
            const permissions =
                await this.permissionsResolver.getEffectivePermissions(
                    requestingUserId,
                );
            if (!permissions.has(PERMISSIONS.MANAGE_DEPARTMENT_QUEUE)) {
                throw new ForbiddenException(
                    'Only the doctor who locked this patient, or a queue manager, can release it.',
                );
            }
            await this.assertDepartmentScope(
                requestingUserId,
                entry.departmentId,
            );
        }

        return this.departmentQueueRepository.release(id);
    }

    async remove(
        id: string,
        dto: RemoveQueueEntryDto,
        requestingUserId: string,
    ) {
        const entry = await this.findById(id, requestingUserId);
        if (entry.status !== 'waiting' && entry.status !== 'in_consultation') {
            throw new ConflictException(
                'Only a waiting or in-consultation entry can be removed.',
            );
        }

        await this.assertDepartmentScope(requestingUserId, entry.departmentId);

        return this.departmentQueueRepository.remove(
            id,
            requestingUserId,
            dto.removedReason,
        );
    }

    private async resolveDepartmentScope(
        requestingUserId: string,
    ): Promise<string | null> {
        const user =
            await this.departmentQueueRepository.findRequestingUserContext(
                requestingUserId,
            );
        if (!user) throw new BadRequestException('Requesting user not found.');

        if (UNRESTRICTED_ROLES.includes(user.role.name)) return null;
        return user.departmentId;
    }

    private async assertDepartmentScope(
        requestingUserId: string,
        targetDepartmentId: string,
    ) {
        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && scope !== targetDepartmentId) {
            throw new ForbiddenException(
                'You can only act on queue entries in your own department.',
            );
        }
    }
}
