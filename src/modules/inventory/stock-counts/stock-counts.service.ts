import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { StockCountsRepository } from './stock-counts.repository';
import { CreateStockCountSessionDto } from './dto/create-session.dto';
import { AddStockCountItemDto } from './dto/add-item.dto';
import { UpdateStockCountItemDto } from './dto/update-item.dto';
import { ListStockCountSessionsDto } from './dto/list-sessions.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../../common/constants/roles.constants';

const UNRESTRICTED_ROLES = [HOSPITAL_MANAGER_ROLE_NAME];

@Injectable()
export class StockCountsService {
    constructor(
        private readonly stockCountsRepository: StockCountsRepository,
    ) {}

    async list(
        dto: ListStockCountSessionsDto,
        requestingUserId: string,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && dto.departmentId && dto.departmentId !== scope) {
            throw new ForbiddenException(
                'You can only view stock counts for your own department.',
            );
        }

        const { items, total } = await this.stockCountsRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            departmentId: dto.departmentId ?? scope ?? undefined,
            status: dto.status,
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
        const session = await this.stockCountsRepository.findById(id);
        if (!session)
            throw new NotFoundException('Stock count session not found.');

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && session.departmentId !== scope) {
            throw new ForbiddenException(
                'You can only view stock counts for your own department.',
            );
        }

        return session;
    }

    async create(dto: CreateStockCountSessionDto, initiatedById: string) {
        const department = await this.stockCountsRepository.findDepartmentType(
            dto.departmentId,
        );
        if (!department)
            throw new BadRequestException('Department does not exist.');
        if (!department.isActive)
            throw new BadRequestException('Department is inactive.');

        await this.assertDepartmentScope(initiatedById, dto.departmentId);

        return this.stockCountsRepository.createSession({
            departmentId: dto.departmentId,
            initiatedById,
            countDate: new Date(dto.countDate),
            notes: dto.notes,
        });
    }

    async addItem(
        sessionId: string,
        dto: AddStockCountItemDto,
        requestingUserId: string,
    ) {
        const session = await this.findById(sessionId, requestingUserId);
        if (session.status !== 'draft')
            throw new ConflictException(
                'Cannot add items to a completed stock count.',
            );

        const variant = await this.stockCountsRepository.findVariant(
            dto.variantId,
        );
        if (!variant) throw new BadRequestException('Variant does not exist.');

        const isLiveTracked =
            session.department.type === 'central_warehouse' ||
            session.department.type === 'pharmacy';

        let expectedQuantity: number;

        if (isLiveTracked) {
            if (!dto.batchId) {
                throw new BadRequestException(
                    'A batchId is required when counting stock at the Central Warehouse or Pharmacy.',
                );
            }
            const batch = await this.stockCountsRepository.findBatch(
                dto.batchId,
            );
            if (!batch) throw new BadRequestException('Batch does not exist.');
            if (batch.variantId !== dto.variantId)
                throw new BadRequestException(
                    'Batch does not match the given variant.',
                );

            const stockRow =
                await this.stockCountsRepository.getLiveBatchQuantity(
                    dto.batchId,
                    session.departmentId,
                );
            expectedQuantity = stockRow ? Number(stockRow.quantity) : 0;
        } else {
            if (dto.batchId) {
                throw new BadRequestException(
                    'Batch-level counting only applies to the Central Warehouse and Pharmacy.',
                );
            }
            const inventoryRow =
                await this.stockCountsRepository.getDepartmentInventoryQuantity(
                    session.departmentId,
                    dto.variantId,
                );
            expectedQuantity = inventoryRow
                ? Number(inventoryRow.currentQuantity)
                : 0;
        }

        return this.stockCountsRepository.addItem({
            sessionId,
            variantId: dto.variantId,
            batchId: dto.batchId,
            expectedQuantity,
            countedQuantity: dto.countedQuantity,
            notes: dto.notes,
        });
    }

    async updateItem(
        sessionId: string,
        itemId: string,
        dto: UpdateStockCountItemDto,
        requestingUserId: string,
    ) {
        const session = await this.findById(sessionId, requestingUserId);
        if (session.status !== 'draft')
            throw new ConflictException(
                'Cannot edit items on a completed stock count.',
            );

        const item = await this.stockCountsRepository.findItemById(itemId);
        if (!item || item.sessionId !== sessionId)
            throw new NotFoundException('Stock count item not found.');

        return this.stockCountsRepository.updateItem(
            itemId,
            dto.countedQuantity,
            Number(item.expectedQuantity),
            dto.notes,
        );
    }

    async complete(sessionId: string, requestingUserId: string) {
        const session = await this.findById(sessionId, requestingUserId);
        if (session.status !== 'draft')
            throw new ConflictException(
                'This stock count has already been completed.',
            );

        const itemCount =
            await this.stockCountsRepository.countItems(sessionId);
        if (itemCount === 0)
            throw new BadRequestException(
                'Cannot complete a stock count with no items.',
            );

        return this.stockCountsRepository.completeSession(sessionId);
    }

    private async resolveDepartmentScope(
        requestingUserId: string,
    ): Promise<string | null> {
        const user =
            await this.stockCountsRepository.findRequestingUserContext(
                requestingUserId,
            );
        if (!user) throw new BadRequestException('Requesting user not found.');

        if (UNRESTRICTED_ROLES.includes(user.role.name)) return null;
        return user.departmentId;
    }

    private async assertDepartmentScope(
        requestingUserId: string,
        targetDepartmentId: string,
    ) {
        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && scope !== targetDepartmentId) {
            throw new ForbiddenException(
                'You can only initiate stock counts for your own department.',
            );
        }
    }
}
