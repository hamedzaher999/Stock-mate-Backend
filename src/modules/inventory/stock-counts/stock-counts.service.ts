import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { StockCountsRepository } from './stock-counts.repository';
import { CreateStockCountSessionDto } from './dto/create-session.dto';
import { AddStockCountItemDto } from './dto/add-item.dto';
import { UpdateStockCountItemDto } from './dto/update-item.dto';
import { ListStockCountSessionsDto } from './dto/list-sessions.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { DepartmentsCacheService } from '../../departments/departments-cache.service';
import { UserScopeService } from '../../rbac/user-scope.service';
import { AlreadyProcessedError } from '../../../common/utils/concurrency.util';
import { InsufficientStockError } from '../../../common/utils/fefo.util';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../../common/constants/roles.constants';

const UNRESTRICTED_ROLES = [HOSPITAL_MANAGER_ROLE_NAME];

@Injectable()
export class StockCountsService {
    constructor(
        private readonly stockCountsRepository: StockCountsRepository,
        private readonly departmentsCacheService: DepartmentsCacheService,
        private readonly userScopeService: UserScopeService,
    ) {}

    async list(
        dto: ListStockCountSessionsDto,
        requestingUserId: string,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && dto.departmentId && dto.departmentId !== scope) {
            throw new ForbiddenException(
                'يمكنك فقط عرض عمليات جرد المخزون الخاصة بقسمك.',
            );
        }

        const { items, total } = await this.stockCountsRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            departmentId: dto.departmentId ?? scope ?? undefined,
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

    async findById(id: string, requestingUserId: string) {
        const session = await this.stockCountsRepository.findById(id);
        if (!session)
            throw new NotFoundException('جلسة جرد المخزون غير موجودة.');

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && session.departmentId !== scope) {
            throw new ForbiddenException(
                'يمكنك فقط عرض عمليات جرد المخزون الخاصة بقسمك.',
            );
        }

        return session;
    }

    async create(dto: CreateStockCountSessionDto, initiatedById: string) {
        const department = await this.departmentsCacheService.getById(
            dto.departmentId,
        );
        if (!department) throw new BadRequestException('القسم غير موجود.');
        if (!department.isActive)
            throw new BadRequestException('القسم غير نشط.');
        if (!department.tracksInventory) {
            throw new BadRequestException('هذا القسم لا يتتبع المخزون.');
        }

        await this.assertDepartmentScope(initiatedById, dto.departmentId);

        const existingDraft =
            await this.stockCountsRepository.findActiveDraftForDepartment(
                dto.departmentId,
            );
        if (existingDraft) {
            throw new ConflictException(
                `يحتوي هذا القسم بالفعل على مسودة جرد مخزون قيد التنفيذ (بدأت في ${existingDraft.createdAt.toISOString()}). يرجى إكمالها أو إلغاؤها قبل بدء واحدة جديدة.`,
            );
        }

        try {
            return await this.stockCountsRepository.createSession({
                departmentId: dto.departmentId,
                initiatedById,
                countDate: new Date(dto.countDate),
                notes: dto.notes,
            });
        } catch (error) {
            if (error instanceof AlreadyProcessedError) {
                throw new ConflictException(error.message);
            }
            throw error;
        }
    }

    async addItem(
        sessionId: string,
        dto: AddStockCountItemDto,
        requestingUserId: string,
    ) {
        const session = await this.findById(sessionId, requestingUserId);
        if (session.status !== 'draft')
            throw new ConflictException(
                'لا يمكن إضافة عناصر إلى عملية جرد مخزون مكتملة.',
            );

        const variant = await this.stockCountsRepository.findVariant(
            dto.variantId,
        );
        if (!variant) throw new BadRequestException('المتغير غير موجود.');

        if (!dto.batchId) {
            throw new BadRequestException(
                'معرف الدفعة (batchId) مطلوب لعملية جرد المخزون.',
            );
        }
        const batch = await this.stockCountsRepository.findBatch(dto.batchId);
        if (!batch) throw new BadRequestException('الدفعة (Batch) غير موجودة.');
        if (batch.variantId !== dto.variantId) {
            throw new BadRequestException(
                'الدفعة لا تتطابق مع المتغير المحدد.',
            );
        }

        const stockRow = await this.stockCountsRepository.getLiveBatchQuantity(
            dto.batchId,
            session.departmentId,
        );
        const expectedQuantity = stockRow ? Number(stockRow.quantity) : 0;

        return this.stockCountsRepository.addItem({
            sessionId,
            variantId: dto.variantId,
            batchId: dto.batchId,
            expectedQuantity,
            countedQuantity: dto.countedQuantity,
            notes: dto.notes,
        });
    }

    async updateItem(
        sessionId: string,
        itemId: string,
        dto: UpdateStockCountItemDto,
        requestingUserId: string,
    ) {
        const session = await this.findById(sessionId, requestingUserId);
        if (session.status !== 'draft')
            throw new ConflictException(
                'لا يمكن تعديل العناصر في عملية جرد مخزون مكتملة.',
            );

        const item = await this.stockCountsRepository.findItemById(itemId);
        if (!item || item.sessionId !== sessionId)
            throw new NotFoundException('عنصر جرد المخزون غير موجود.');

        return this.stockCountsRepository.updateItem(
            itemId,
            dto.countedQuantity,
            Number(item.expectedQuantity),
            dto.notes,
        );
    }

    async complete(sessionId: string, requestingUserId: string) {
        const session = await this.findById(sessionId, requestingUserId);
        if (session.status !== 'draft')
            throw new ConflictException('تم إكمال جرد المخزون هذا مسبقاً.');

        const itemCount =
            await this.stockCountsRepository.countItems(sessionId);
        if (itemCount === 0)
            throw new BadRequestException(
                'لا يمكن إكمال جرد مخزون لا يحتوي على أي عناصر.',
            );

        try {
            return await this.stockCountsRepository.completeSession(
                sessionId,
                requestingUserId,
            );
        } catch (error) {
            if (error instanceof AlreadyProcessedError) {
                throw new ConflictException(error.message);
            }
            if (error instanceof InsufficientStockError) {
                throw new ConflictException(
                    'تعذر إكمال عملية الجرد -- لقد تغير المخزون المباشر منذ عملية العد وأصبح غير كافٍ لتطبيق تسوية العجز لعنصر واحد أو أكثر. يرجى مراجعة مستويات المخزون الحالية أولاً.',
                );
            }
            throw error;
        }
    }

    async cancel(sessionId: string, requestingUserId: string) {
        const session = await this.findById(sessionId, requestingUserId);
        if (session.status !== 'draft') {
            throw new ConflictException(
                'يمكن فقط إلغاء مسودة جرد المخزون -- الجرد المكتمل يعد سجلاً دائماً.',
            );
        }

        try {
            await this.stockCountsRepository.deleteDraft(sessionId);
        } catch (error) {
            if (error instanceof AlreadyProcessedError) {
                throw new ConflictException(error.message);
            }
            throw error;
        }
    }

    private async resolveDepartmentScope(
        requestingUserId: string,
    ): Promise<string | null> {
        const scope =
            await this.userScopeService.getUserScope(requestingUserId);
        if (!scope) throw new BadRequestException('المستخدم الطالب غير موجود.');

        if (scope.isSuperAdmin || UNRESTRICTED_ROLES.includes(scope.roleName))
            return null;
        return scope.departmentId;
    }

    private async assertDepartmentScope(
        requestingUserId: string,
        targetDepartmentId: string,
    ) {
        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && scope !== targetDepartmentId) {
            throw new ForbiddenException(
                'يمكنك بدء عمليات جرد المخزون لقسمك فقط.',
            );
        }
    }
}
