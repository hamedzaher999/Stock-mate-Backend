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
import { RefillDeliveriesRepository } from '../refill-deliveries/refill-deliveries.repository';

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
        private readonly refillDeliveriesRepository: RefillDeliveriesRepository,
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
                'يمكنك فقط عرض طلبات التزويد الخاصة بقسمك.',
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
        if (!request) throw new NotFoundException('طلب التزويد غير موجود.');
        return request;
    }

    async findByIdForUser(id: string, requestingUserId: string) {
        const request = await this.findById(id);

        const departmentScope =
            await this.resolveDepartmentScope(requestingUserId);
        if (departmentScope && request.departmentId !== departmentScope) {
            throw new ForbiddenException(
                'يمكنك فقط عرض طلبات التزويد الخاصة بقسمك.',
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
                'فترة التكرار تنطبق فقط على الطلبات المتكررة (غير العادية).',
            );
        }
        if (requestType !== 'normal' && !dto.frequencyInterval) {
            throw new BadRequestException(
                'فترة التكرار (عدد الفترات) مطلوبة للطلب المتكرر.',
            );
        }

        const requesterScope =
            await this.userScopeService.getUserScope(requestedById);
        if (!requesterScope?.departmentId) {
            throw new BadRequestException(
                'يجب تعيينك إلى قسم لتنفيذ طلب تزويد.',
            );
        }

        const department = await this.departmentsCacheService.getById(
            requesterScope.departmentId,
        );
        if (!department) {
            throw new BadRequestException(
                'يجب تعيينك إلى قسم لتنفيذ طلب تزويد.',
            );
        }
        if (department.type === 'central_warehouse') {
            throw new BadRequestException(
                'المستودع المركزي لا يقدم طلبات تزويد -- بل يقوم بتلبيتها.',
            );
        }
        if (!department.isActive) {
            throw new BadRequestException('قسمك غير مفعل حالياً.');
        }

        await this.assertVariantsConfiguredForDepartment(
            requesterScope.departmentId,
            variantIds,
        );

        const created = await this.refillRequestsRepository.create({
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

        const hospitalManager =
            await this.refillRequestsRepository.findHospitalManagerId();

        if (hospitalManager) {
            await this.notificationsService.create({
                userId: hospitalManager.id,

                type: NOTIFICATION_TYPES.REFILL_REQUEST_STATUS_CHANGED,

                category: 'inventory',

                title: 'طلب تزويد جديد بانتظار الموافقة',

                body: `تم إنشاء طلب تزويد جديد (${created.requestNumber}) وهو بانتظار موافقتك.`,

                data: { refillRequestId: created.id, status: created.status },
            });
        }

        return created;
    }
    async update(
        id: string,
        dto: UpdateRefillRequestDto,
        requestingUserId: string,
    ) {
        const request = await this.findById(id);
        if (request.status !== 'draft')
            throw new ConflictException(
                'يمكن تعديل طلبات التزويد المسودة فقط.',
            );

        if (request.requestedById !== requestingUserId) {
            throw new ForbiddenException(
                'يمكنك فقط تعديل طلبات التزويد التي أنشأتها.',
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
                'يمكن تقديم طلبات التزويد المسودة فقط.',
            );
        if (request.items.length === 0)
            throw new BadRequestException(
                'لا يمكن تقديم طلب تزويد بدون عناصر.',
            );

        if (request.requestedById !== requestingUserId) {
            throw new ForbiddenException(
                'يمكنك فقط تقديم طلبات التزويد التي أنشأتها.',
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
            throw new ConflictException('هذا الطلب لا ينتظر موافقة المستشفى.');
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
            throw new ConflictException('هذا الطلب لا ينتظر موافقة المستشفى.');
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
            throw new ConflictException('هذا الطلب لا ينتظر موافقة المستشفى.');
        }

        const itemIds = new Set(request.items.map((i) => i.id));
        const dtoItemIds = new Set(dto.items.map((i) => i.refillItemId));
        if (
            itemIds.size !== dtoItemIds.size ||
            ![...itemIds].every((itemId) => dtoItemIds.has(itemId))
        ) {
            throw new BadRequestException(
                'يجب توفير الكميات الموافق عليها لكل عنصر في هذا الطلب بدقة.',
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
                    `الكمية الموافق عليها للبديل "${item.variant.variantName}" لا يمكن أن تتجاوز الكمية المطلوبة.`,
                );
            }
        }

        const isNewRecurringProposal =
            request.requestType !== 'normal' &&
            request.periodicScheduleId === null;

        if (isNewRecurringProposal && !dto.approvalPolicy) {
            throw new BadRequestException(
                'سياسة الموافقة مطلوبة للموافقة على جدول تزويد متكرر جديد.',
            );
        }
        if (!isNewRecurringProposal && dto.approvalPolicy) {
            throw new BadRequestException(
                'سياسة الموافقة تنطبق فقط عند الموافقة على مقترح جدول متكرر جديد تماماً.',
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

            const confirmedDeliveries =
                await this.refillRequestsRepository.countConfirmedDeliveriesForRequest(
                    id,
                );
            if (confirmedDeliveries > 0) {
                throw new ConflictException(
                    'Cannot reject once at least one delivery has been confirmed for this request -- complete it instead once all deliveries are confirmed.',
                );
            }

            const warehouse =
                await this.departmentsCacheService.getByType(
                    'central_warehouse',
                );
            if (!warehouse) {
                throw new BadRequestException(
                    'No Central Warehouse department is configured.',
                );
            }

            await this.refillDeliveriesRepository.cancelUnconfirmedDeliveriesForRequest(
                {
                    refillRequestId: id,
                    warehouseDepartmentId: warehouse.id,
                    cancelledById: requestingUserId,
                },
            );

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
                'يمكن إكمال الطلبات التي تنتظر دفعات إضافية يدوياً فقط.',
            );
        }
        if (request.approvedById !== requestingUserId) {
            throw new ForbiddenException(
                'فقط المدير الذي وافق على هذا الطلب يمكنه إكماله.',
            );
        }

        const pending =
            await this.refillRequestsRepository.countUnconfirmedDeliveriesForRequest(
                id,
            );
        if (pending > 0) {
            throw new ConflictException(
                `لا يمكن الإكمال بعد -- ${pending} من عمليات التسليم المرتبطة بهذا الطلب لا تزال تنتظر التأكيد من القسم المستلم.`,
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
                `لا يمكن إلغاء طلب بالحالة "${request.status}".`,
            );
        }
        if (request.requestedById !== requestingUserId) {
            throw new ForbiddenException(
                'يمكنك فقط إلغاء طلبات التزويد التي قمت بإنشائها.',
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
            throw new BadRequestException('بديل واحد أو أكثر غير موجود.');

        const inactive = variants.filter(
            (v) => !v.isActive || !v.product.isActive,
        );
        if (inactive.length > 0) {
            throw new BadRequestException(
                'بديل واحد أو أكثر من البدائل المختارة (أو المنتج الأساسي التابع لها) غير مفعل.',
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
            throw new NotFoundException('لم يتم العثور على عنصر التزويد.');
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
                `البدائل التالية غير مُكوّنة كعناصر مخزون نشطة لهذا القسم: ${unconfigured.join(', ')}.`,
            );
        }
    }
}
