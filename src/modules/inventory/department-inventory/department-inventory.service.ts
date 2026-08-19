import {
    BadRequestException,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { DepartmentInventoryRepository } from './department-inventory.repository';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { DepartmentsCacheService } from '../../departments/departments-cache.service';
import { UserScopeService } from '../../rbac/user-scope.service';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../../common/constants/roles.constants';
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
        if (!department) throw new BadRequestException('القسم غير موجود.');
        if (!department.tracksInventory) {
            throw new BadRequestException('هذا القسم لا يتتبع المخزون.');
        }

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && departmentId !== scope) {
            throw new ForbiddenException(
                'يمكنك فقط عرض المخزون المباشر لقسمك.',
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
        if (!scope) throw new BadRequestException('المستخدم الطالب غير موجود.');

        if (scope.isSuperAdmin || UNRESTRICTED_ROLES.includes(scope.roleName))
            return null;
        return scope.departmentId;
    }
}
