import {
    BadRequestException,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { ConsumptionRepository } from './consumption.repository';
import { CreateConsumptionDto } from './dto/create-consumption.dto';
import { InsufficientStockError } from '../../../common/utils/fefo.util';
import { DepartmentsCacheService } from '../../departments/departments-cache.service';
import { UserScopeService } from '../../rbac/user-scope.service';

@Injectable()
export class ConsumptionService {
    constructor(
        private readonly consumptionRepository: ConsumptionRepository,
        private readonly departmentsCacheService: DepartmentsCacheService,
        private readonly userScopeService: UserScopeService,
    ) {}

    async create(dto: CreateConsumptionDto, performedById: string) {
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

        await this.assertDepartmentScope(performedById, dto.departmentId);

        for (const line of dto.items) {
            const variant =
                await this.consumptionRepository.findVariantMaterialType(
                    line.variantId,
                );
            if (!variant)
                throw new BadRequestException('Variant does not exist.');
            if (!variant.isActive || !variant.product.isActive) {
                throw new BadRequestException(
                    'Cannot consume an inactive variant.',
                );
            }
            if (variant.product.materialType === 'fixed_asset') {
                throw new BadRequestException(
                    'Fixed assets cannot be consumed -- report damaged or shrinkage instead.',
                );
            }
        }

        try {
            return await this.consumptionRepository.consume({
                departmentId: dto.departmentId,
                performedById,
                notes: dto.notes,
                lines: dto.items,
            });
        } catch (error) {
            if (error instanceof InsufficientStockError) {
                throw new BadRequestException(
                    'Insufficient stock to record this consumption.',
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

        if (scope.isSuperAdmin) return null;
        return scope.departmentId;
    }

    private async assertDepartmentScope(
        requestingUserId: string,
        targetDepartmentId: string,
    ) {
        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && scope !== targetDepartmentId) {
            throw new ForbiddenException(
                'You can only record consumption for your own department.',
            );
        }
    }
}
