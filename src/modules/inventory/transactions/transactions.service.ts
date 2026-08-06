import {
    BadRequestException,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { TransactionsRepository } from './transactions.repository';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { UserScopeService } from '../../rbac/user-scope.service';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../../common/constants/roles.constants';
const UNRESTRICTED_ROLES = [HOSPITAL_MANAGER_ROLE_NAME];

@Injectable()
export class TransactionsService {
    constructor(
        private readonly transactionsRepository: TransactionsRepository,
        private readonly userScopeService: UserScopeService,
    ) {}

    async list(
        dto: ListTransactionsDto,
        requestingUserId: string,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const scope = await this.resolveDepartmentScope(requestingUserId);

        if (!scope.unrestricted) {
            if (!scope.departmentId) {
                return { items: [], total: 0, page, limit, totalPages: 0 };
            }
            if (dto.departmentId && dto.departmentId !== scope.departmentId) {
                throw new ForbiddenException(
                    'You can only view transactions for your own department.',
                );
            }
        }

        const departmentId = scope.unrestricted
            ? dto.departmentId
            : (scope.departmentId ?? undefined);

        const { items, total } = await this.transactionsRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            departmentId,
            variantId: dto.variantId,
            batchId: dto.batchId,
            transactionType: dto.transactionType,
        });

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
    ): Promise<{ unrestricted: boolean; departmentId: string | null }> {
        const scope =
            await this.userScopeService.getUserScope(requestingUserId);
        if (!scope) throw new BadRequestException('Requesting user not found.');

        const unrestricted =
            scope.isSuperAdmin || UNRESTRICTED_ROLES.includes(scope.roleName);

        return { unrestricted, departmentId: scope.departmentId };
    }
}
