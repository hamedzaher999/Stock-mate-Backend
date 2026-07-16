import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AdjustmentType } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class ListAdjustmentsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsEnum(AdjustmentType)
  adjustmentType?: AdjustmentType;
}
