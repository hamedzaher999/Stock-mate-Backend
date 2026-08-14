import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { RefillRequestsRepository } from './refill-requests.repository';
import { NotificationsService } from '../../notifications/notifications.service';
import { DepartmentsCacheService } from '../../departments/departments-cache.service';
import { UserScopeService } from '../../rbac/user-scope.service';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { generateRequestNumber } from '../../../common/utils/request-number-generator.util';
import { NOTIFICATION_TYPES } from '../../../common/constants/notification-types.constants';
import {
    HOSPITAL_MANAGER_ROLE_NAME,
    WAREHOUSE_MANAGER_ROLE_NAME,
} from '../../../common/constants/roles.constants';
import { CreateRefillRequestDto } from './dto/create-refill-request.dto';
import { UpdateRefillRequestDto } from './dto/update-refill-request.dto';
import { ApproveRefillRequestDto } from './dto/approve-refill-request.dto';
import { ListRefillRequestsDto } from './dto/list-refill-requests.dto';
import { RejectRequestDto } from '../../../common/dto/reject-request.dto';
import { AlreadyProcessedError } from '../../../common/utils/concurrency.util';

const UNRESTRICTED_ROLES = [
    WAREHOUSE_MANAGER_ROLE_NAME,
    HOSPITAL_MANAGER_ROLE_NAME,
];
const CANCELLABLE_STATUSES = [
    'draft',
    'pending_hospital_approval',
    'pending_manager_approval',
];

@Injectable()
export class RefillRequestsService {
    constructor(
        private readonly refillRequestsRepository: RefillRequestsRepository,
        private readonly notificationsService: NotificationsService,
        private readonly departmentsCacheService: DepartmentsCacheService,
        private readonly userScopeService: UserScopeService,
    ) {}

    async list(
        dto: ListRefillRequestsDto,
        requestingUserId: string,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const departmentScope =
            await this.resolveDepartmentScope(requestingUserId);

        if (
            departmentScope &&
            dto.departmentId &&
            dto.departmentId !== departmentScope
        ) {
            throw new ForbiddenException(
                'You can only view refill requests from your own department.',
            );
        }

        const { items, total } = await this.refillRequestsRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            status: dto.status,
            departmentId: departmentScope ?? dto.departmentId,
            priority: dto.priority,
            requestType: dto.requestType,
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

        const requesterScope =
            await this.userScopeService.getUserScope(requestedById);
        if (!requesterScope?.departmentId) {
            throw new BadRequestException(
                'You must be assigned to a department to create a refill request.',
            );
        }

        const department = await this.departmentsCacheService.getById(
            requesterScope.departmentId,
        );
        if (!department) {
            throw new BadRequestException(
                'You must be assigned to a department to create a refill request.',
            );
        }
        if (department.type === 'central_warehouse') {
            throw new BadRequestException(
                'The Central Warehouse does not submit refill requests -- it fulfills them.',
            );
        }
        if (!department.isActive) {
            throw new BadRequestException(
                'Your department is currently inactive.',
            );
        }

        await this.assertVariantsConfiguredForDepartment(
            requesterScope.departmentId,
            variantIds,
        );

        return this.refillRequestsRepository.create({
            requestNumber: generateRequestNumber('DRF'),
            departmentId: requesterScope.departmentId,
            requestedById,
            priority: dto.priority ?? 'normal',
            requestType,
            frequencyInterval:
                requestType === 'normal' ? undefined : dto.frequencyInterval,
            notes: dto.notes,
            items: dto.items,
        });
    }
    async update(
        id: string,
        dto: UpdateRefillRequestDto,
        requestingUserId: string,
    ) {
        const request = await this.findById(id);
        if (request.status !== 'draft')
            throw new ConflictException(
                'Only draft refill requests can be edited.',
            );

        if (request.requestedById !== requestingUserId) {
            throw new ForbiddenException(
                'You can only edit refill requests you created.',
            );
        }

        if (dto.items) {
            const variantIds = [...new Set(dto.items.map((i) => i.variantId))];
            await this.assertVariantsActive(variantIds);
            await this.assertVariantsConfiguredForDepartment(
                request.departmentId,
                variantIds,
            );
        }

        return this.refillRequestsRepository.replaceItems(
            id,
            dto.notes,
            dto.items,
        );
    }

    async submit(id: string, requestingUserId: string) {
        const request = await this.findById(id);
        if (request.status !== 'draft')
            throw new ConflictException(
                'Only draft refill requests can be submitted.',
            );
        if (request.items.length === 0)
            throw new BadRequestException(
                'Cannot submit a refill request with no items.',
            );

        if (request.requestedById !== requestingUserId) {
            throw new ForbiddenException(
                'You can only submit refill requests you created.',
            );
        }

        const updated = await this.runGuarded(() =>
            this.refillRequestsRepository.updateStatus(id, 'draft', {
                status: 'pending_hospital_approval',
            }),
        );
        await this.notifyStatusChange(updated);
        return updated;
    }
    async hospitalApprove(id: string, approverId: string) {
        const request = await this.findById(id);
        if (request.status !== 'pending_hospital_approval') {
            throw new ConflictException(
                'This request is not awaiting hospital approval.',
            );
        }

        const updated = await this.runGuarded(() =>
            this.refillRequestsRepository.updateStatus(
                id,
                'pending_hospital_approval',
                {
                    status: 'pending_manager_approval',
                    hospitalApprovedById: approverId,
                    hospitalApprovedAt: new Date(),
                },
            ),
        );
        await this.notifyStatusChange(updated);
        return updated;
    }

    async hospitalReject(id: string, dto: RejectRequestDto) {
        const request = await this.findById(id);
        if (request.status !== 'pending_hospital_approval') {
            throw new ConflictException(
                'This request is not awaiting hospital approval.',
            );
        }

        const updated = await this.runGuarded(() =>
            this.refillRequestsRepository.updateStatus(
                id,
                'pending_hospital_approval',
                {
                    status: 'hospital_rejected',
                    hospitalRejectionReason: dto.reason,
                },
            ),
        );
        await this.notifyStatusChange(updated);
        return updated;
    }

    async approve(
        id: string,
        dto: ApproveRefillRequestDto,
        approverId: string,
    ) {
        const request = await this.findById(id);
        if (request.status !== 'pending_manager_approval') {
            throw new ConflictException(
                'This request is not awaiting manager approval.',
            );
        }

        const itemIds = new Set(request.items.map((i) => i.id));
        const dtoItemIds = new Set(dto.items.map((i) => i.refillItemId));
        if (
            itemIds.size !== dtoItemIds.size ||
            ![...itemIds].every((itemId) => dtoItemIds.has(itemId))
        ) {
            throw new BadRequestException(
                'Approved quantities must be provided for exactly every item on this request.',
            );
        }

        for (const approval of dto.items) {
            const item = request.items.find(
                (i) => i.id === approval.refillItemId,
            );
            if (
                item &&
                approval.approvedQuantity > Number(item.requestedQuantity)
            ) {
                throw new BadRequestException(
                    `Approved quantity for variant "${item.variant.variantName}" cannot exceed the requested quantity.`,
                );
            }
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

        const updated = await this.runGuarded(() =>
            this.refillRequestsRepository.approveWithQuantities(
                id,
                approverId,
                dto.items,
                isNewRecurringProposal ? dto.approvalPolicy : undefined,
            ),
        );
        await this.notifyStatusChange(updated);
        return updated;
    }

    async reject(id: string, dto: RejectRequestDto, requestingUserId: string) {
        const request = await this.findById(id);

        if (request.status === 'pending_manager_approval') {
            const updated = await this.runGuarded(() =>
                this.refillRequestsRepository.updateStatus(
                    id,
                    'pending_manager_approval',
                    {
                        status: 'manager_rejected',
                        rejectionReason: dto.reason,
                    },
                ),
            );
            await this.notifyStatusChange(updated);
            return updated;
        }

        if (request.status === 'preparing') {
            if (request.approvedById !== requestingUserId) {
                throw new ForbiddenException(
                    'Only the manager who approved this request can reject it.',
                );
            }

            const linkedDeliveries =
                await this.refillRequestsRepository.countDeliveriesForRequest(
                    id,
                );
            if (linkedDeliveries > 0) {
                throw new ConflictException(
                    'Cannot reject once at least one delivery has been generated for this request -- complete it instead once all deliveries are confirmed.',
                );
            }

            const updated = await this.runGuarded(() =>
                this.refillRequestsRepository.updateStatus(id, 'preparing', {
                    status: 'manager_rejected',
                    rejectionReason: dto.reason,
                }),
            );
            await this.notifyStatusChange(updated);
            return updated;
        }

        throw new ConflictException(
            'This request cannot be rejected from its current status.',
        );
    }

    async complete(id: string, requestingUserId: string) {
        const request = await this.findById(id);
        if (request.status !== 'partially_complete') {
            throw new ConflictException(
                'Only a request awaiting further batches can be manually completed.',
            );
        }
        if (request.approvedById !== requestingUserId) {
            throw new ForbiddenException(
                'Only the manager who approved this request can complete it.',
            );
        }

        const pending =
            await this.refillRequestsRepository.countUnconfirmedDeliveriesForRequest(
                id,
            );
        if (pending > 0) {
            throw new ConflictException(
                `Cannot complete yet -- ${pending} delivery(ies) linked to this request are still awaiting confirmation from the receiving department.`,
            );
        }

        const updated = await this.runGuarded(() =>
            this.refillRequestsRepository.manualComplete(id),
        );
        await this.notifyStatusChange(updated);
        return updated;
    }

    async cancel(id: string, requestingUserId: string) {
        const request = await this.findById(id);
        if (!CANCELLABLE_STATUSES.includes(request.status)) {
            throw new ConflictException(
                `A request with status "${request.status}" cannot be cancelled.`,
            );
        }
        if (request.requestedById !== requestingUserId) {
            throw new ForbiddenException(
                'You can only cancel refill requests you created.',
            );
        }

        const updated = await this.runGuarded(() =>
            this.refillRequestsRepository.updateStatus(id, request.status, {
                status: 'cancelled',
            }),
        );
        await this.notifyStatusChange(updated);
        return updated;
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

    private async resolveDepartmentScope(
        requestingUserId: string,
    ): Promise<string | null> {
        const scope =
            await this.userScopeService.getUserScope(requestingUserId);
        if (!scope) throw new BadRequestException('Requesting user not found.');

        if (scope.isSuperAdmin || UNRESTRICTED_ROLES.includes(scope.roleName))
            return null;
        return scope.departmentId;
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
    private async runGuarded<T>(action: () => Promise<T>): Promise<T> {
        try {
            return await action();
        } catch (error) {
            if (error instanceof AlreadyProcessedError) {
                throw new ConflictException(error.message);
            }
            throw error;
        }
    }
    private async assertVariantsConfiguredForDepartment(
        departmentId: string,
        variantIds: string[],
    ) {
        const configuredIds =
            await this.refillRequestsRepository.findConfiguredVariantIds(
                departmentId,
                variantIds,
            );
        const configuredSet = new Set(configuredIds);
        const unconfigured = variantIds.filter((id) => !configuredSet.has(id));

        if (unconfigured.length > 0) {
            throw new BadRequestException(
                `The following variant(s) are not configured as active stock items for this department: ${unconfigured.join(', ')}.`,
            );
        }
    }
}
