import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PurchaseRequestsRepository } from './purchase-requests.repository';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';
import { HospitalRejectDto } from './dto/hospital-reject.dto';
import { CommitteeApproveDto } from './dto/committee-approve.dto';
import { CommitteeRejectDto } from './dto/committee-reject.dto';
import { ListPurchaseRequestsDto } from './dto/list-purchase-requests.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { generateRequestNumber } from '../../../common/utils/request-number-generator.util';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../../common/constants/roles.constants';
import { NotificationsService } from '../../notifications/notifications.service';
import { NOTIFICATION_TYPES } from '../../../common/constants/notification-types.constants';
import { UserScopeService } from '../../rbac/user-scope.service';

const CANCELLABLE_STATUSES = [
    'draft',
    'pending_hospital_approval',
    'pending_purchasing_committee',
    'approved',
    'ready_for_receiving',
];
const UNRESTRICTED_ROLES = [
    HOSPITAL_MANAGER_ROLE_NAME,
    'purchasing_committee_manager',
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

        const updated = await this.purchaseRequestsRepository.updateStatus(id, {
            status: 'pending_hospital_approval',
        });
        await this.notifyStatusChange(updated);
        return updated;
    }

    async hospitalApprove(id: string, approverId: string) {
        const pr = await this.findById(id);
        if (pr.status !== 'pending_hospital_approval')
            throw new ConflictException(
                'This request is not awaiting hospital approval.',
            );

        const updated = await this.purchaseRequestsRepository.updateStatus(id, {
            status: 'pending_purchasing_committee',
            hospitalApprovedById: approverId,
            hospitalApprovedAt: new Date(),
        });
        await this.notifyStatusChange(updated);
        return updated;
    }

    async hospitalReject(id: string, dto: HospitalRejectDto) {
        const pr = await this.findById(id);
        if (pr.status !== 'pending_hospital_approval')
            throw new ConflictException(
                'This request is not awaiting hospital approval.',
            );

        const updated = await this.purchaseRequestsRepository.updateStatus(id, {
            status: 'rejected',
            hospitalRejectionReason: dto.reason,
        });
        await this.notifyStatusChange(updated);
        return updated;
    }

    async committeeApprove(
        id: string,
        dto: CommitteeApproveDto,
        approverId: string,
    ) {
        const pr = await this.findById(id);
        if (pr.status !== 'pending_purchasing_committee')
            throw new ConflictException(
                'This request is not awaiting committee approval.',
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

        const updated =
            await this.purchaseRequestsRepository.setCommitteeApprovedQuantities(
                id,
                dto.items,
                approverId,
            );
        await this.notifyStatusChange(updated);
        return updated;
    }

    async committeeReject(id: string, dto: CommitteeRejectDto) {
        const pr = await this.findById(id);
        if (pr.status !== 'pending_purchasing_committee')
            throw new ConflictException(
                'This request is not awaiting committee approval.',
            );

        const updated = await this.purchaseRequestsRepository.updateStatus(id, {
            status: 'rejected',
            committeeRejectionReason: dto.reason,
        });
        await this.notifyStatusChange(updated);
        return updated;
    }

    async markReadyForReceiving(id: string, userId: string) {
        const pr = await this.findById(id);
        if (pr.status !== 'approved') {
            throw new ConflictException(
                'This request must be approved by the committee before it can be marked ready for receiving.',
            );
        }

        const missingQuantities = pr.items.some(
            (item) => item.committeeApprovedQuantity === null,
        );
        if (missingQuantities)
            throw new BadRequestException(
                'Every item must have a committee-approved quantity first.',
            );

        const updated = await this.purchaseRequestsRepository.updateStatus(id, {
            status: 'ready_for_receiving',
            committeeMarkedReadyById: userId,
            committeeMarkedReadyAt: new Date(),
        });
        await this.notifyStatusChange(updated);
        return updated;
    }

    async cancel(id: string) {
        const pr = await this.findById(id);
        if (!CANCELLABLE_STATUSES.includes(pr.status)) {
            throw new ConflictException(
                `A request with status "${pr.status}" cannot be cancelled.`,
            );
        }

        const updated = await this.purchaseRequestsRepository.updateStatus(id, {
            status: 'cancelled',
        });
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
