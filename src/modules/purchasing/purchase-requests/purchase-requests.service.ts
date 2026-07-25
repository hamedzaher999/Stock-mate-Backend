import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PurchaseRequestsRepository } from './purchase-requests.repository';
import { NotificationsService } from '../../notifications/notifications.service';
import { UserScopeService } from '../../rbac/user-scope.service';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { generateRequestNumber } from '../../../common/utils/request-number-generator.util';
import { NOTIFICATION_TYPES } from '../../../common/constants/notification-types.constants';
import {
    HOSPITAL_MANAGER_ROLE_NAME,
    PURCHASING_MANAGER_ROLE_NAME,
} from '../../../common/constants/roles.constants';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';
import { ApprovePurchaseRequestDto } from './dto/approve-purchase-request.dto';
import { RejectRequestDto } from '../../../common/dto/reject-request.dto';
import { ListPurchaseRequestsDto } from './dto/list-purchase-requests.dto';
import { AlreadyProcessedError } from '../../../common/utils/concurrency.util';
const CANCELLABLE_STATUSES = [
    'draft',
    'pending_hospital_approval',
    'pending_manager_approval',
];
const UNRESTRICTED_ROLES = [
    HOSPITAL_MANAGER_ROLE_NAME,
    PURCHASING_MANAGER_ROLE_NAME,
];
@Injectable()
export class PurchaseRequestsService {
    constructor(
        private readonly purchaseRequestsRepository: PurchaseRequestsRepository,
        private readonly notificationsService: NotificationsService,
        private readonly userScopeService: UserScopeService,
    ) {}

    async list(
        dto: ListPurchaseRequestsDto,
        requestingUserId: string,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const ownerScope = await this.resolveOwnerScope(requestingUserId);

        const { items, total } = await this.purchaseRequestsRepository.findMany(
            {
                skip: (page - 1) * limit,
                take: limit,
                status: dto.status,
                requestedById: ownerScope ?? undefined,
            },
        );

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    private async findById(id: string) {
        const pr = await this.purchaseRequestsRepository.findById(id);
        if (!pr) throw new NotFoundException('Purchase request not found.');
        return pr;
    }

    async findByIdForUser(id: string, requestingUserId: string) {
        const pr = await this.findById(id);

        const ownerScope = await this.resolveOwnerScope(requestingUserId);
        if (ownerScope && pr.requestedById !== ownerScope) {
            throw new ForbiddenException(
                'You can only view purchase requests you created.',
            );
        }

        return pr;
    }

    async create(dto: CreatePurchaseRequestDto, requestedById: string) {
        const variantIds = [...new Set(dto.items.map((i) => i.variantId))];
        await this.assertVariantsActive(variantIds);

        return this.purchaseRequestsRepository.create({
            requestNumber: generateRequestNumber('PR'),
            requestedById,
            notes: dto.notes,
            items: dto.items,
        });
    }

    async update(id: string, dto: UpdatePurchaseRequestDto) {
        const pr = await this.findById(id);
        if (pr.status !== 'draft')
            throw new ConflictException(
                'Only draft purchase requests can be edited.',
            );

        if (dto.items) {
            const variantIds = [...new Set(dto.items.map((i) => i.variantId))];
            await this.assertVariantsActive(variantIds);
        }

        return this.purchaseRequestsRepository.replaceItems(
            id,
            dto.notes,
            dto.items,
        );
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

    async submit(id: string) {
        const pr = await this.findById(id);
        if (pr.status !== 'draft')
            throw new ConflictException(
                'Only draft purchase requests can be submitted.',
            );
        if (pr.items.length === 0)
            throw new BadRequestException(
                'Cannot submit a purchase request with no items.',
            );

        const updated = await this.runGuarded(() =>
            this.purchaseRequestsRepository.updateStatus(id, 'draft', {
                status: 'pending_hospital_approval',
            }),
        );
        await this.notifyStatusChange(updated);
        return updated;
    }

    async hospitalApprove(id: string, approverId: string) {
        const pr = await this.findById(id);
        if (pr.status !== 'pending_hospital_approval')
            throw new ConflictException(
                'This request is not awaiting hospital approval.',
            );

        const updated = await this.runGuarded(() =>
            this.purchaseRequestsRepository.updateStatus(
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
        const pr = await this.findById(id);
        if (pr.status !== 'pending_hospital_approval')
            throw new ConflictException(
                'This request is not awaiting hospital approval.',
            );

        const updated = await this.runGuarded(() =>
            this.purchaseRequestsRepository.updateStatus(
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
        dto: ApprovePurchaseRequestDto,
        approverId: string,
    ) {
        const pr = await this.findById(id);
        if (pr.status !== 'pending_manager_approval')
            throw new ConflictException(
                'This request is not awaiting manager approval.',
            );

        const itemIds = new Set(pr.items.map((i) => i.id));
        const dtoItemIds = new Set(
            dto.items.map((i) => i.purchaseRequestItemId),
        );
        if (
            itemIds.size !== dtoItemIds.size ||
            ![...itemIds].every((itemId) => dtoItemIds.has(itemId))
        ) {
            throw new BadRequestException(
                'Approved quantities must be provided for exactly every item on this request.',
            );
        }

        for (const approval of dto.items) {
            const item = pr.items.find(
                (i) => i.id === approval.purchaseRequestItemId,
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

        const updated = await this.runGuarded(() =>
            this.purchaseRequestsRepository.approveWithQuantities(
                id,
                approverId,
                dto.items,
            ),
        );
        await this.notifyStatusChange(updated);
        return updated;
    }

    async reject(id: string, dto: RejectRequestDto, requestingUserId: string) {
        const pr = await this.findById(id);

        if (pr.status === 'pending_manager_approval') {
            const updated = await this.runGuarded(() =>
                this.purchaseRequestsRepository.updateStatus(
                    id,
                    'pending_manager_approval',
                    { status: 'manager_rejected', rejectionReason: dto.reason },
                ),
            );
            await this.notifyStatusChange(updated);
            return updated;
        }

        if (pr.status === 'preparing') {
            if (pr.approvedById !== requestingUserId) {
                throw new ForbiddenException(
                    'Only the manager who approved this request can reject it.',
                );
            }

            const linkedReceipts =
                await this.purchaseRequestsRepository.countReceiptsForRequest(
                    id,
                );
            if (linkedReceipts > 0) {
                throw new ConflictException(
                    'Cannot reject once at least one receipt has been generated for this request -- complete it instead once all receipts are confirmed.',
                );
            }

            const updated = await this.runGuarded(() =>
                this.purchaseRequestsRepository.updateStatus(id, 'preparing', {
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
        const pr = await this.findById(id);
        if (pr.status !== 'partially_complete') {
            throw new ConflictException(
                'Only a request awaiting further batches can be manually completed.',
            );
        }
        if (pr.approvedById !== requestingUserId) {
            throw new ForbiddenException(
                'Only the manager who approved this request can complete it.',
            );
        }

        const pending =
            await this.purchaseRequestsRepository.countUnconfirmedReceiptsForRequest(
                id,
            );
        if (pending > 0) {
            throw new ConflictException(
                `Cannot complete yet -- ${pending} receipt(s) linked to this request are still awaiting confirmation from the receiver.`,
            );
        }

        const updated = await this.runGuarded(() =>
            this.purchaseRequestsRepository.manualComplete(id),
        );
        await this.notifyStatusChange(updated);
        return updated;
    }

    async cancel(id: string, requestingUserId: string) {
        const pr = await this.findById(id);
        if (!CANCELLABLE_STATUSES.includes(pr.status)) {
            throw new ConflictException(
                `A request with status "${pr.status}" cannot be cancelled.`,
            );
        }

        const ownerScope = await this.resolveOwnerScope(requestingUserId);
        if (ownerScope && pr.requestedById !== ownerScope) {
            throw new ForbiddenException(
                'You can only cancel purchase requests you created.',
            );
        }

        const updated = await this.runGuarded(() =>
            this.purchaseRequestsRepository.updateStatus(id, pr.status, {
                status: 'cancelled',
            }),
        );
        await this.notifyStatusChange(updated);
        return updated;
    }

    private async resolveOwnerScope(
        requestingUserId: string,
    ): Promise<string | null> {
        const scope =
            await this.userScopeService.getUserScope(requestingUserId);
        if (!scope) throw new BadRequestException('Requesting user not found.');

        if (UNRESTRICTED_ROLES.includes(scope.roleName)) return null;
        return requestingUserId;
    }

    private async assertVariantsActive(variantIds: string[]) {
        const variants =
            await this.purchaseRequestsRepository.findVariantsWithActivation(
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

    private notifyStatusChange(pr: {
        id: string;
        requestNumber: string;
        requestedById: string;
        status: string;
    }) {
        return this.notificationsService.create({
            userId: pr.requestedById,
            type: NOTIFICATION_TYPES.PURCHASE_REQUEST_STATUS_CHANGED,
            category: 'purchasing',
            title: 'Purchase request status updated',
            body: `Purchase request ${pr.requestNumber} is now "${pr.status}".`,
            data: { purchaseRequestId: pr.id, status: pr.status },
        });
    }
}
