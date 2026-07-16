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

const UNRESTRICTED_ROLES = [HOSPITAL_MANAGER_ROLE_NAME];
const INCREASING_ADJUSTMENT_TYPES = ['found'];

@Injectable()
export class AdjustmentsService {
  constructor(private readonly adjustmentsRepository: AdjustmentsRepository) {}

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

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(dto: CreateAdjustmentDto, reportedById: string) {
    const batch = await this.adjustmentsRepository.findBatch(dto.batchId);
    if (!batch) throw new BadRequestException('Batch does not exist.');
    if (batch.variantId !== dto.variantId)
      throw new BadRequestException('Batch does not match the given variant.');

    const department = await this.adjustmentsRepository.findDepartmentType(
      dto.departmentId,
    );
    if (!department)
      throw new BadRequestException('Department does not exist.');
    if (!department.isActive)
      throw new BadRequestException('Department is inactive.');

    await this.assertDepartmentScope(reportedById, dto.departmentId);

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

    const isLiveTracked =
      department.type === 'central_warehouse' || department.type === 'pharmacy';
    const isIncreasing = INCREASING_ADJUSTMENT_TYPES.includes(
      dto.adjustmentType,
    );

    if (!isLiveTracked && dto.adjustmentType === 'shrinkage') {
      throw new BadRequestException(
        'Only the Central Warehouse or Pharmacy can report shrinkage; other departments may only report damaged or expired items.',
      );
    }

    if (!isIncreasing) {
      if (isLiveTracked) {
        const batchStock = await this.adjustmentsRepository.findBatchStock(
          dto.batchId,
          dto.departmentId,
        );
        if (!batchStock || Number(batchStock.quantity) < dto.quantity) {
          throw new BadRequestException(
            'Insufficient stock in this batch at this department for the requested adjustment.',
          );
        }
      } else {
        const everReceived =
          await this.adjustmentsRepository.hasDepartmentReceivedBatch(
            dto.departmentId,
            dto.batchId,
          );
        if (!everReceived) {
          throw new BadRequestException(
            'This department has no record of ever receiving this batch.',
          );
        }

        const inventoryRow =
          await this.adjustmentsRepository.findDepartmentInventory(
            dto.departmentId,
            dto.variantId,
          );
        if (
          !inventoryRow ||
          Number(inventoryRow.currentQuantity) < dto.quantity
        ) {
          throw new BadRequestException(
            'Adjustment quantity exceeds the currently recorded stock for this variant.',
          );
        }
      }
    } else if (!isLiveTracked) {
      const everReceived =
        await this.adjustmentsRepository.hasDepartmentReceivedBatch(
          dto.departmentId,
          dto.batchId,
        );
      if (!everReceived) {
        throw new BadRequestException(
          'This department has no record of ever receiving this batch.',
        );
      }
    }

    return this.adjustmentsRepository.createAdjustment({
      ...dto,
      reportedById,
      isLiveTracked,
    });
  }

  private async resolveDepartmentScope(
    requestingUserId: string,
  ): Promise<string | null> {
    const user =
      await this.adjustmentsRepository.findRequestingUserContext(
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
        'You can only report adjustments for your own department.',
      );
    }
  }
}
