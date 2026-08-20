import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { StockSettingsRepository } from './stock-settings.repository';
import { CreateStockSettingDto } from './dto/create-stock-setting.dto';
import { UpdateStockSettingDto } from './dto/update-stock-setting.dto';
import { UpdateStockSettingStatusDto } from './dto/update-stock-setting-status.dto';
import { ListStockSettingsDto } from './dto/list-stock-settings.dto';
import { PaginatedResult } from '../../core/interfaces/paginated-result.interface';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../common/constants/roles.constants';
import { DepartmentsCacheService } from '../departments/departments-cache.service';
import { UserScopeService } from '../rbac/user-scope.service';
import { Prisma } from '@prisma/client';
const UNRESTRICTED_ROLES = [HOSPITAL_MANAGER_ROLE_NAME];

@Injectable()
export class StockSettingsService {
    constructor(
        private readonly stockSettingsRepository: StockSettingsRepository,
        private readonly departmentsCacheService: DepartmentsCacheService,
        private readonly userScopeService: UserScopeService,
    ) {}

    async list(
        dto: ListStockSettingsDto,
        requestingUserId: string,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && dto.departmentId && dto.departmentId !== scope) {
            throw new ForbiddenException(
                'يمكنك فقط عرض إعدادات المخزون الخاصة بقسمك.',
            );
        }

        const { items, total } = await this.stockSettingsRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            departmentId: dto.departmentId ?? scope ?? undefined,
            variantId: dto.variantId,
            isActive:
                dto.isActive === undefined
                    ? undefined
                    : dto.isActive === 'true',
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
        const setting = await this.fetchById(id);

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && setting.departmentId !== scope) {
            throw new ForbiddenException(
                'يمكنك فقط عرض إعدادات المخزون الخاصة بقسمك.',
            );
        }

        return setting;
    }

    async create(dto: CreateStockSettingDto, requestingUserId: string) {
        // await this.assertDepartmentScope(requestingUserId, dto.departmentId);

        const department = await this.departmentsCacheService.getById(
            dto.departmentId,
        );
        if (!department) throw new BadRequestException('القسم غير موجود.');
        if (!department.isActive) {
            throw new BadRequestException(
                'لا يمكن تكوين إعدادات المخزون لقسم غير نشط.',
            );
        }

        const results: {
            variantId: string;
            success: boolean;
            data?: unknown;
            error?: string;
        }[] = [];

        const seenVariantIds = new Set<string>();
        const dedupedItems = dto.items.filter((item) => {
            if (seenVariantIds.has(item.variantId)) {
                results.push({
                    variantId: item.variantId,
                    success: false,
                    error: 'معرف الصنف (variantId) مكرر في هذا الطلب -- تمت معالجة الظهور الأول فقط.',
                });
                return false;
            }
            seenVariantIds.add(item.variantId);
            return true;
        });

        const variantIds = dedupedItems.map((i) => i.variantId);
        const [variants, existingSettings] = await Promise.all([
            this.stockSettingsRepository.findVariantsExistence(variantIds),
            this.stockSettingsRepository.findExistingForVariantsInDepartment(
                variantIds,
                dto.departmentId,
            ),
        ]);
        const variantById = new Map(variants.map((v) => [v.id, v]));
        const existingVariantIds = new Set(
            existingSettings.map((s) => s.variantId),
        );

        for (const item of dedupedItems) {
            try {
                this.assertValidRange(item.minimumStock, item.maximumStock);

                const variant = variantById.get(item.variantId);
                if (!variant) {
                    throw new BadRequestException('الصنف غير موجود.');
                }
                if (!variant.isActive || !variant.product.isActive) {
                    throw new BadRequestException(
                        'لا يمكن تكوين إعدادات المخزون لصنف غير نشط.',
                    );
                }
                if (existingVariantIds.has(item.variantId)) {
                    throw new ConflictException(
                        'هذا الصنف مُكوَّن مسبقاً لهذا القسم.',
                    );
                }

                const created = await this.stockSettingsRepository.create({
                    variantId: item.variantId,
                    departmentId: dto.departmentId,
                    storageLocation: item.storageLocation,
                    minimumStock: item.minimumStock,
                    maximumStock: item.maximumStock,
                    createdById: requestingUserId,
                });

                results.push({
                    variantId: item.variantId,
                    success: true,
                    data: created,
                });
            } catch (error) {
                results.push({
                    variantId: item.variantId,
                    success: false,
                    error: this.extractErrorMessage(error),
                });
            }
        }

        const createdCount = results.filter((r) => r.success).length;
        const failedCount = results.filter((r) => !r.success).length;

        if (createdCount === 0) {
            throw new BadRequestException({
                message: 'فشل إنشاء جميع عناصر إعدادات المخزون.',
                results,
            });
        }

        return { created: createdCount, failed: failedCount, results };
    }

    private extractErrorMessage(error: unknown): string {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            return 'هذا الصنف مُكوَّن مسبقاً لهذا القسم.';
        }
        if (
            error instanceof BadRequestException ||
            error instanceof ConflictException
        ) {
            const response = error.getResponse();
            if (
                typeof response === 'object' &&
                response !== null &&
                'message' in response
            ) {
                const msg = (response as { message: string | string[] })
                    .message;
                return Array.isArray(msg) ? msg.join(', ') : msg;
            }
            return error.message;
        }
        return 'فشل إنشاء إعداد المخزون.';
    }
    async update(
        id: string,
        dto: UpdateStockSettingDto,
        requestingUserId: string,
    ) {
        const existing = await this.fetchById(id);
        await this.assertDepartmentScope(
            requestingUserId,
            existing.departmentId,
        );

        const effectiveMin =
            dto.minimumStock ??
            (existing.minimumStock ? Number(existing.minimumStock) : undefined);
        const effectiveMax =
            dto.maximumStock ??
            (existing.maximumStock ? Number(existing.maximumStock) : undefined);
        this.assertValidRange(effectiveMin, effectiveMax);

        return this.stockSettingsRepository.update(id, dto);
    }

    async updateStatus(
        id: string,
        dto: UpdateStockSettingStatusDto,
        requestingUserId: string,
    ) {
        const existing = await this.fetchById(id);
        await this.assertDepartmentScope(
            requestingUserId,
            existing.departmentId,
        );
        return this.stockSettingsRepository.updateStatus(id, dto.isActive);
    }

    async delete(id: string, requestingUserId: string) {
        const existing = await this.fetchById(id);
        await this.assertDepartmentScope(
            requestingUserId,
            existing.departmentId,
        );
        return this.stockSettingsRepository.delete(id);
    }

    private async fetchById(id: string) {
        const setting = await this.stockSettingsRepository.findById(id);
        if (!setting) throw new NotFoundException('إعداد المخزون غير موجود.');
        return setting;
    }

    private assertValidRange(min?: number, max?: number) {
        if (min !== undefined && max !== undefined && min > max) {
            throw new BadRequestException(
                'لا يمكن أن يكون الحد الأدنى للمخزون أكبر من الحد الأقصى.',
            );
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
                'يمكنك فقط إدارة إعدادات المخزون الخاصة بقسمك.',
            );
        }
    }
}
