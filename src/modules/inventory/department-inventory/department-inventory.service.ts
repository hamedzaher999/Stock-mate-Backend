import {
    BadRequestException,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { DepartmentInventoryRepository } from './department-inventory.repository';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../../common/constants/roles.constants';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { DepartmentsCacheService } from '../../departments/departments-cache.service';
import { UserScopeService } from '../../rbac/user-scope.service';
const UNRESTRICTED_ROLES = [HOSPITAL_MANAGER_ROLE_NAME];

@Injectable()
export class DepartmentInventoryService {
    constructor(
        private readonly departmentInventoryRepository: DepartmentInventoryRepository,
        private readonly departmentsCacheService: DepartmentsCacheService,
        private readonly userScopeService: UserScopeService,
    ) {}

    async getLiveStock(
        departmentId: string,
        requestingUserId: string,
        page = 1,
        limit = 20,
    ): Promise<PaginatedResult<unknown>> {
        const department =
            await this.departmentsCacheService.getById(departmentId);
        if (!department)
            throw new BadRequestException('Department does not exist.');
        if (!department.tracksInventory) {
            throw new BadRequestException(
                'This department does not track inventory.',
            );
        }

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && departmentId !== scope) {
            throw new ForbiddenException(
                'You can only view live stock for your own department.',
            );
        }

        const { items, total } =
            await this.departmentInventoryRepository.findLiveStockPage(
                departmentId,
                (page - 1) * limit,
                limit,
            );

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
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
}
