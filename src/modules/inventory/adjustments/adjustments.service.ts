import {
    BadRequestException,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { AdjustmentsRepository } from './adjustments.repository';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { ListAdjustmentsDto } from './dto/list-adjustments.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../../common/constants/roles.constants';
import { InsufficientStockError } from '../../../common/utils/fefo.util';
import { DepartmentsCacheService } from '../../departments/departments-cache.service';
import { UserScopeService } from '../../rbac/user-scope.service';
const UNRESTRICTED_ROLES = [HOSPITAL_MANAGER_ROLE_NAME];
const INCREASING_ADJUSTMENT_TYPES = ['found'];
const FIXED_ASSET_ALLOWED_TYPES = ['damaged', 'shrinkage'];

@Injectable()
export class AdjustmentsService {
    constructor(
        private readonly adjustmentsRepository: AdjustmentsRepository,
        private readonly departmentsCacheService: DepartmentsCacheService,
        private readonly userScopeService: UserScopeService,
    ) {}

    async list(
        dto: ListAdjustmentsDto,
        requestingUserId: string,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && dto.departmentId && dto.departmentId !== scope) {
            throw new ForbiddenException(
                'You can only view adjustments for your own department.',
            );
        }

        const { items, total } = await this.adjustmentsRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            departmentId: dto.departmentId ?? scope ?? undefined,
            variantId: dto.variantId,
            adjustmentType: dto.adjustmentType,
        });

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async create(dto: CreateAdjustmentDto, reportedById: string) {
        const batch = await this.adjustmentsRepository.findBatch(dto.batchId);
        if (!batch) throw new BadRequestException('Batch does not exist.');
        if (batch.variantId !== dto.variantId)
            throw new BadRequestException(
                'Batch does not match the given variant.',
            );

        const department = await this.departmentsCacheService.getById(
            dto.departmentId,
        );
        if (!department)
            throw new BadRequestException('Department does not exist.');
        if (!department.isActive)
            throw new BadRequestException('Department is inactive.');
        if (!department.tracksInventory) {
            throw new BadRequestException(
                'This department does not track inventory.',
            );
        }

        await this.assertDepartmentScope(reportedById, dto.departmentId);

        const variant =
            await this.adjustmentsRepository.findVariantMaterialType(
                dto.variantId,
            );
        if (!variant) throw new BadRequestException('Variant does not exist.');
        if (
            variant.product.materialType === 'fixed_asset' &&
            !FIXED_ASSET_ALLOWED_TYPES.includes(dto.adjustmentType)
        ) {
            throw new BadRequestException(
                'Fixed assets can only be adjusted as damaged or shrinkage.',
            );
        }

        if (dto.stockCountSessionId) {
            const sessionExists =
                await this.adjustmentsRepository.stockCountSessionExists(
                    dto.stockCountSessionId,
                );
            if (!sessionExists)
                throw new BadRequestException(
                    'Referenced stock count session does not exist.',
                );
        }

        const isIncreasing = INCREASING_ADJUSTMENT_TYPES.includes(
            dto.adjustmentType,
        );

        if (!isIncreasing) {
            const batchStock = await this.adjustmentsRepository.findBatchStock(
                dto.batchId,
                dto.departmentId,
            );
            if (!batchStock || Number(batchStock.quantity) < dto.quantity) {
                throw new BadRequestException(
                    'Insufficient stock in this batch at this department for the requested adjustment.',
                );
            }
        }
        try {
            return await this.adjustmentsRepository.createAdjustment({
                ...dto,
                reportedById,
            });
        } catch (error) {
            if (error instanceof InsufficientStockError) {
                throw new BadRequestException(
                    'Insufficient stock in this batch at this department for the requested adjustment.',
                );
            }
            throw error;
        }
    }
    private async resolveDepartmentScope(
        requestingUserId: string,
    ): Promise<string | null> {
        const scope =
            await this.userScopeService.getUserScope(requestingUserId);
        if (!scope) throw new BadRequestException('Requesting user not found.');

        if (UNRESTRICTED_ROLES.includes(scope.roleName)) return null;
        return scope.departmentId;
    }
    private async assertDepartmentScope(
        requestingUserId: string,
        targetDepartmentId: string,
    ) {
        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && scope !== targetDepartmentId) {
            throw new ForbiddenException(
                'You can only report adjustments for your own department.',
            );
        }
    }
}
