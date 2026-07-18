import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { DepartmentInventoryRepository } from './department-inventory.repository';
import { ListDepartmentInventoryDto } from './dto/list-department-inventory.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../../common/constants/roles.constants';

const UNRESTRICTED_ROLES = [HOSPITAL_MANAGER_ROLE_NAME];

@Injectable()
export class DepartmentInventoryService {
    constructor(
        private readonly departmentInventoryRepository: DepartmentInventoryRepository,
    ) {}

    async list(
        dto: ListDepartmentInventoryDto,
        requestingUserId: string,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && dto.departmentId && dto.departmentId !== scope) {
            throw new ForbiddenException(
                'You can only view inventory for your own department.',
            );
        }

        const { items, total } =
            await this.departmentInventoryRepository.findMany({
                skip: (page - 1) * limit,
                take: limit,
                departmentId: dto.departmentId ?? scope ?? undefined,
                variantId: dto.variantId,
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
        const row = await this.departmentInventoryRepository.findById(id);
        if (!row) throw new NotFoundException('Inventory snapshot not found.');

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && row.departmentId !== scope) {
            throw new ForbiddenException(
                'You can only view inventory for your own department.',
            );
        }

        return row;
    }

    async getLiveStock(departmentId: string, requestingUserId: string) {
        const department =
            await this.departmentInventoryRepository.findDepartmentType(
                departmentId,
            );
        if (!department)
            throw new BadRequestException('Department does not exist.');
        if (
            department.type !== 'central_warehouse' &&
            department.type !== 'pharmacy'
        ) {
            throw new BadRequestException(
                'Live batch-level stock is only tracked for the Central Warehouse and Pharmacy.',
            );
        }

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && departmentId !== scope) {
            throw new ForbiddenException(
                'You can only view live stock for your own department.',
            );
        }

        return this.departmentInventoryRepository.findLiveStock(departmentId);
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
