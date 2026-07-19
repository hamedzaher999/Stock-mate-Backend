import {
    BadRequestException,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { DepartmentInventoryRepository } from './department-inventory.repository';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../../common/constants/roles.constants';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
const UNRESTRICTED_ROLES = [HOSPITAL_MANAGER_ROLE_NAME];

@Injectable()
export class DepartmentInventoryService {
    constructor(
        private readonly departmentInventoryRepository: DepartmentInventoryRepository,
    ) {}

    async getLiveStock(
        departmentId: string,
        requestingUserId: string,
        page = 1,
        limit = 20,
    ): Promise<PaginatedResult<unknown>> {
        const department =
            await this.departmentInventoryRepository.findDepartmentType(
                departmentId,
            );
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

        const total =
            await this.departmentInventoryRepository.countDistinctVariants(
                departmentId,
            );
        const items =
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
        const user =
            await this.departmentInventoryRepository.findRequestingUserContext(
                requestingUserId,
            );
        if (!user) throw new BadRequestException('Requesting user not found.');

        if (UNRESTRICTED_ROLES.includes(user.role.name)) return null;
        return user.departmentId;
    }
}
