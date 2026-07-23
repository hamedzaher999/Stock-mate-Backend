import {
    BadRequestException,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { TransactionsRepository } from './transactions.repository';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../../common/constants/roles.constants';
import { UserScopeService } from '../../rbac/user-scope.service';

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
        if (scope && dto.departmentId && dto.departmentId !== scope) {
            throw new ForbiddenException(
                'You can only view transactions for your own department.',
            );
        }

        const { items, total } = await this.transactionsRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            departmentId: dto.departmentId ?? scope ?? undefined,
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
    ): Promise<string | null> {
        const scope =
            await this.userScopeService.getUserScope(requestingUserId);
        if (!scope) throw new BadRequestException('Requesting user not found.');

        if (UNRESTRICTED_ROLES.includes(scope.roleName)) return null;
        return scope.departmentId;
    }
}
