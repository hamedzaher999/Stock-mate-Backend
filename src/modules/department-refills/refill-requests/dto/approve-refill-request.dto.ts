import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsEnum,
    IsNumber,
    IsOptional,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';
import { ScheduleApprovalPolicy } from '@prisma/client';

class ApprovedItemDto {
    @IsUUID()
    refillItemId!: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    approvedQuantity!: number;
}

export class ApproveRefillRequestDto {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ApprovedItemDto)
    items!: ApprovedItemDto[];

    @IsOptional()
    @IsEnum(ScheduleApprovalPolicy)
    approvalPolicy?: ScheduleApprovalPolicy;
}
