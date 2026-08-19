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
    PURCHASING_MANAGER_ROLE_NAME,
    HOSPITAL_MANAGER_ROLE_NAME,
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
                priority: dto.priority,
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
        if (!pr) throw new NotFoundException('طلب الشراء غير موجود.');
        return pr;
    }

    async findByIdForUser(id: string, requestingUserId: string) {
        const pr = await this.findById(id);

        const ownerScope = await this.resolveOwnerScope(requestingUserId);
        if (ownerScope && pr.requestedById !== ownerScope) {
            throw new ForbiddenException(
                'يمكنك فقط عرض طلبات الشراء التي قمت بإنشائها.',
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
            priority: dto.priority,
            notes: dto.notes,
            items: dto.items,
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
    async update(
        id: string,
        dto: UpdatePurchaseRequestDto,
        requestingUserId: string,
    ) {
        const pr = await this.findById(id);
        if (pr.status !== 'draft')
            throw new ConflictException('يمكن تعديل مسودات طلبات الشراء فقط.');

        const ownerScope = await this.resolveOwnerScope(requestingUserId);
        if (ownerScope && pr.requestedById !== ownerScope) {
            throw new ForbiddenException(
                'يمكنك تعديل طلبات الشراء التي أنشأتها أنت فقط.',
            );
        }

        if (dto.items) {
            const variantIds = [...new Set(dto.items.map((i) => i.variantId))];
            await this.assertVariantsActive(variantIds);
        }

        return this.purchaseRequestsRepository.replaceItems(
            id,
            dto.notes,
            dto.priority,
            dto.items,
        );
    }

    async submit(id: string, requestingUserId: string) {
        const pr = await this.findById(id);
        if (pr.status !== 'draft')
            throw new ConflictException('يمكن تقديم مسودات طلبات الشراء فقط.');
        if (pr.items.length === 0)
            throw new BadRequestException('لا يمكن تقديم طلب شراء بدون عناصر.');

        const ownerScope = await this.resolveOwnerScope(requestingUserId);
        if (ownerScope && pr.requestedById !== ownerScope) {
            throw new ForbiddenException(
                'يمكنك تقديم طلبات الشراء التي أنشأتها أنت فقط.',
            );
        }

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
                'هذا الطلب ليس بانتظار موافقة المستشفى.',
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
                'هذا الطلب ليس بانتظار موافقة المستشفى.',
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
            throw new ConflictException('هذا الطلب ليس بانتظار موافقة المدير.');

        const itemIds = new Set(pr.items.map((i) => i.id));
        const dtoItemIds = new Set(
            dto.items.map((i) => i.purchaseRequestItemId),
        );
        if (
            itemIds.size !== dtoItemIds.size ||
            ![...itemIds].every((itemId) => dtoItemIds.has(itemId))
        ) {
            throw new BadRequestException(
                'يجب توفير الكميات الموافق عليها لكل عنصر في هذا الطلب بدقة.',
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
                    `لا يمكن أن تتجاوز الكمية الموافق عليها للمنتج "${item.variant.variantName}" الكمية المطلوبة.`,
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
                    'فقط المدير الذي وافق على هذا الطلب يمكنه رفضه.',
                );
            }

            const linkedReceipts =
                await this.purchaseRequestsRepository.countReceiptsForRequest(
                    id,
                );
            if (linkedReceipts > 0) {
                throw new ConflictException(
                    'لا يمكن الرفض بمجرد إنشاء إيصال واحد على الأقل لهذا الطلب - قم بإكماله بدلاً من ذلك بمجرد تأكيد جميع الإيصالات.',
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

        throw new ConflictException('لا يمكن رفض هذا الطلب من حالته الحالية.');
    }

    async complete(id: string, requestingUserId: string) {
        const pr = await this.findById(id);
        if (pr.status !== 'partially_complete') {
            throw new ConflictException(
                'يمكن إكمال الطلبات التي تنتظر دفعات إضافية يدوياً فقط.',
            );
        }
        if (pr.approvedById !== requestingUserId) {
            throw new ForbiddenException(
                'فقط المدير الذي وافق على هذا الطلب يمكنه إكماله.',
            );
        }

        const pending =
            await this.purchaseRequestsRepository.countUnconfirmedReceiptsForRequest(
                id,
            );
        if (pending > 0) {
            throw new ConflictException(
                `لا يمكن الإكمال بعد - ${pending} إيصال (إيصالات) مرتبطة بهذا الطلب لا تزال بانتظار التأكيد من المستلم.`,
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
                `لا يمكن إلغاء طلب بالحالة "${pr.status}".`,
            );
        }

        const ownerScope = await this.resolveOwnerScope(requestingUserId);
        if (ownerScope && pr.requestedById !== ownerScope) {
            throw new ForbiddenException(
                'يمكنك إلغاء طلبات الشراء التي أنشأتها أنت فقط.',
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
        if (!scope) throw new BadRequestException('المستخدم الطالب غير موجود.');

        if (scope.isSuperAdmin || UNRESTRICTED_ROLES.includes(scope.roleName))
            return null;
        return requestingUserId;
    }

    private async assertVariantsActive(variantIds: string[]) {
        const variants =
            await this.purchaseRequestsRepository.findVariantsWithActivation(
                variantIds,
            );
        if (variants.length !== variantIds.length)
            throw new BadRequestException(
                'واحد أو أكثر من المتغيرات غير موجود.',
            );

        const inactive = variants.filter(
            (v) => !v.isActive || !v.product.isActive,
        );
        if (inactive.length > 0) {
            throw new BadRequestException(
                'واحد أو أكثر من المتغيرات المحددة (أو المنتج الرئيسي المرتبط به) غير نشط.',
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
            title: 'تم تحديث حالة طلب الشراء',
            body: `طلب الشراء ${pr.requestNumber} أصبح الآن "${pr.status}".`,
            data: { purchaseRequestId: pr.id, status: pr.status },
        });
    }
}
