import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { RefillRequestsRepository } from './refill-requests.repository';
import { CreateRefillRequestDto } from './dto/create-refill-request.dto';
import { UpdateRefillRequestDto } from './dto/update-refill-request.dto';
import { HospitalRejectDto } from './dto/hospital-reject.dto';
import { PrepareRefillRequestDto } from './dto/prepare-refill-request.dto';
import { ListRefillRequestsDto } from './dto/list-refill-requests.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { generateRequestNumber } from '../../../common/utils/request-number-generator.util';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../../common/constants/roles.constants';
import { HospitalApproveRefillRequestDto } from './dto/hospital-approve-refill-request.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { NOTIFICATION_TYPES } from '../../../common/constants/notification-types.constants';
const UNRESTRICTED_ROLES = [HOSPITAL_MANAGER_ROLE_NAME, 'warehouse_manager'];
const CANCELLABLE_STATUSES = [
    'draft',
    'pending_hospital_approval',
    'approved',
    'ready_for_delivery',
];

@Injectable()
export class RefillRequestsService {
    constructor(
        private readonly refillRequestsRepository: RefillRequestsRepository,
        private readonly notificationsService: NotificationsService,
    ) {}

    async list(
        dto: ListRefillRequestsDto,
        requestingUserId: string,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const departmentScope =
            await this.resolveDepartmentScope(requestingUserId);

        const { items, total } = await this.refillRequestsRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            status: dto.status,
            departmentId: departmentScope ?? undefined,
        });

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    private async findById(id: string) {
        const request = await this.refillRequestsRepository.findById(id);
        if (!request) throw new NotFoundException('Refill request not found.');
        return request;
    }

    async findByIdForUser(id: string, requestingUserId: string) {
        const request = await this.findById(id);

        const departmentScope =
            await this.resolveDepartmentScope(requestingUserId);
        if (departmentScope && request.departmentId !== departmentScope) {
            throw new ForbiddenException(
                'You can only view refill requests from your own department.',
            );
        }

        return request;
    }

    async create(dto: CreateRefillRequestDto, requestedById: string) {
        const variantIds = [...new Set(dto.items.map((i) => i.variantId))];
        await this.assertVariantsActive(variantIds);

        const requestType = dto.requestType ?? 'normal';
        if (requestType === 'normal' && dto.frequencyInterval) {
            throw new BadRequestException(
                'frequencyInterval only applies to recurring (non-normal) requests.',
            );
        }
        if (requestType !== 'normal' && !dto.frequencyInterval) {
            throw new BadRequestException(
                'frequencyInterval (the period count) is required for a recurring request.',
            );
        }

        const requesterContext =
            await this.refillRequestsRepository.findRequestingUserContext(
                requestedById,
            );
        if (!requesterContext?.departmentId || !requesterContext.department) {
            throw new BadRequestException(
                'You must be assigned to a department to create a refill request.',
            );
        }
        if (requesterContext.department.type === 'central_warehouse') {
            throw new BadRequestException(
                'The Central Warehouse does not submit refill requests -- it fulfills them.',
            );
        }
        if (!requesterContext.department.isActive) {
            throw new BadRequestException(
                'Your department is currently inactive.',
            );
        }

        return this.refillRequestsRepository.create({
            requestNumber: generateRequestNumber('DRF'),
            departmentId: requesterContext.departmentId,
            requestedById,
            priority: dto.priority ?? 'normal',
            requestType,
            frequencyInterval:
                requestType === 'normal' ? undefined : dto.frequencyInterval,
            notes: dto.notes,
            items: dto.items,
        });
    }

    async update(id: string, dto: UpdateRefillRequestDto) {
        const request = await this.findById(id);
        if (request.status !== 'draft')
            throw new ConflictException(
                'Only draft refill requests can be edited.',
            );

        if (dto.items) {
            const variantIds = [...new Set(dto.items.map((i) => i.variantId))];
            await this.assertVariantsActive(variantIds);
        }

        return this.refillRequestsRepository.replaceItems(
            id,
            dto.notes,
            dto.items,
        );
    }

    private async assertVariantsActive(variantIds: string[]) {
        const variants =
            await this.refillRequestsRepository.findVariantsWithActivation(
                variantIds,
            );
        if (variants.length !== variantIds.length)
            throw new BadRequestException('One or more variants do not exist.');

        const inactive = variants.filter(
            (v) => !v.isActive || !v.product.isActive,
        );
        if (inactive.length > 0) {
            throw new BadRequestException(
                'One or more selected variants (or their parent product) are inactive.',
            );
        }
    }

    async submit(id: string) {
        const request = await this.findById(id);
        if (request.status !== 'draft')
            throw new ConflictException(
                'Only draft refill requests can be submitted.',
            );
        if (request.items.length === 0)
            throw new BadRequestException(
                'Cannot submit a refill request with no items.',
            );

        const updated = await this.refillRequestsRepository.updateStatus(id, {
            status: 'pending_hospital_approval',
        });
        await this.notifyStatusChange(updated);
        return updated;
    }

    async hospitalApprove(
        id: string,
        dto: HospitalApproveRefillRequestDto,
        approverId: string,
    ) {
        const request = await this.findById(id);
        if (request.status !== 'pending_hospital_approval') {
            throw new ConflictException(
                'This request is not awaiting hospital approval.',
            );
        }

        const isNewRecurringProposal =
            request.requestType !== 'normal' &&
            request.periodicScheduleId === null;

        if (isNewRecurringProposal && !dto.approvalPolicy) {
            throw new BadRequestException(
                'approvalPolicy is required to approve a new recurring refill schedule.',
            );
        }
        if (!isNewRecurringProposal && dto.approvalPolicy) {
            throw new BadRequestException(
                'approvalPolicy only applies when approving a brand-new recurring schedule proposal.',
            );
        }

        const updated =
            await this.refillRequestsRepository.hospitalApproveAndMaybeCreateSchedule(
                id,
                approverId,
                isNewRecurringProposal ? dto.approvalPolicy : undefined,
            );
        await this.notifyStatusChange(updated);
        return updated;
    }

    async hospitalReject(id: string, dto: HospitalRejectDto) {
        const request = await this.findById(id);
        if (request.status !== 'pending_hospital_approval') {
            throw new ConflictException(
                'This request is not awaiting hospital approval.',
            );
        }

        const updated = await this.refillRequestsRepository.updateStatus(id, {
            status: 'cancelled',
            hospitalRejectionReason: dto.reason,
        });
        await this.notifyStatusChange(updated);
        return updated;
    }

    async startPreparing(id: string) {
        const request = await this.findById(id);
        if (request.status !== 'approved') {
            throw new ConflictException(
                'Only approved refill requests can be moved to preparing.',
            );
        }
        const updated = await this.refillRequestsRepository.updateStatus(id, {
            status: 'preparing',
        });
        await this.notifyStatusChange(updated);
        return updated;
    }

    async prepare(id: string, dto: PrepareRefillRequestDto) {
        const request = await this.findById(id);
        if (request.status !== 'preparing') {
            throw new ConflictException(
                'Only requests currently being prepared can have prepared quantities set.',
            );
        }

        const itemIds = new Set(request.items.map((i) => i.id));
        const dtoItemIds = new Set(dto.items.map((i) => i.refillItemId));
        if (
            itemIds.size !== dtoItemIds.size ||
            ![...itemIds].every((itemId) => dtoItemIds.has(itemId))
        ) {
            throw new BadRequestException(
                'Prepared quantities must be provided for exactly every item on this request.',
            );
        }

        for (const prepared of dto.items) {
            const item = request.items.find(
                (i) => i.id === prepared.refillItemId,
            );
            if (
                item &&
                prepared.preparedQuantity > Number(item.requestedQuantity)
            ) {
                throw new BadRequestException(
                    `Prepared quantity for variant "${item.variant.variantName}" cannot exceed the requested quantity.`,
                );
            }
        }

        const updated =
            await this.refillRequestsRepository.setPreparedQuantities(
                id,
                dto.items,
            );
        await this.notifyStatusChange(updated);
        return updated;
    }

    async cancel(id: string) {
        const request = await this.findById(id);
        if (!CANCELLABLE_STATUSES.includes(request.status)) {
            throw new ConflictException(
                `A request with status "${request.status}" cannot be cancelled.`,
            );
        }

        const updated = await this.refillRequestsRepository.updateStatus(id, {
            status: 'cancelled',
        });
        await this.notifyStatusChange(updated);
        return updated;
    }
    private async resolveDepartmentScope(
        requestingUserId: string,
    ): Promise<string | null> {
        const user =
            await this.refillRequestsRepository.findRequestingUserContext(
                requestingUserId,
            );
        if (!user) throw new BadRequestException('Requesting user not found.');

        if (UNRESTRICTED_ROLES.includes(user.role.name)) return null;
        return user.departmentId;
    }
    async getItem(
        refillRequestId: string,
        itemId: string,
        requestingUserId: string,
    ) {
        await this.findByIdForUser(refillRequestId, requestingUserId);

        const item = await this.refillRequestsRepository.findItemById(itemId);
        if (!item || item.refillRequestId !== refillRequestId) {
            throw new NotFoundException('Refill item not found.');
        }

        return item;
    }

    private notifyStatusChange(request: {
        id: string;
        requestNumber: string;
        requestedById: string;
        status: string;
    }) {
        return this.notificationsService.create({
            userId: request.requestedById,
            type: NOTIFICATION_TYPES.REFILL_REQUEST_STATUS_CHANGED,
            category: 'inventory',
            title: 'Refill request status updated',
            body: `Refill request ${request.requestNumber} is now "${request.status}".`,
            data: { refillRequestId: request.id, status: request.status },
        });
    }
}
