import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { BatchesRepository } from './batches.repository';
import { ListBatchesDto } from './dto/list-batches.dto';
import { PaginatedResult } from '../../core/interfaces/paginated-result.interface';
import { UserScopeService } from '../rbac/user-scope.service';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../common/constants/roles.constants';
const UNRESTRICTED_ROLES = [HOSPITAL_MANAGER_ROLE_NAME];

@Injectable()
export class BatchesService {
    constructor(
        private readonly batchesRepository: BatchesRepository,
        private readonly userScopeService: UserScopeService,
    ) {}

    async list(
        dto: ListBatchesDto,
        requestingUserId: string,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && dto.departmentId && dto.departmentId !== scope) {
            throw new ForbiddenException('يمكنك فقط عرض الدفعات الخاصة بقسمك.');
        }

        const { items, total } = await this.batchesRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            variantId: dto.variantId,
            departmentId: dto.departmentId ?? scope ?? undefined,
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
        const batch = await this.batchesRepository.findById(id);
        if (!batch) throw new NotFoundException('الدفعة غير موجودة.');

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (!scope) return batch;

        return {
            ...batch,
            batchStocks: batch.batchStocks.filter(
                (bs) => bs.departmentId === scope,
            ),
        };
    }

    private async resolveDepartmentScope(
        requestingUserId: string,
    ): Promise<string | null> {
        const scope =
            await this.userScopeService.getUserScope(requestingUserId);
        if (!scope)
            throw new BadRequestException('المستخدم المطلوب غير موجود.');

        if (UNRESTRICTED_ROLES.includes(scope.roleName)) return null; // ❌ same missing check
        return scope.departmentId;
    }
}
