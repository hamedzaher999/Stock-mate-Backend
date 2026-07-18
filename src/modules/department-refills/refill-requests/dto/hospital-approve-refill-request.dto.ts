import { IsEnum, IsOptional } from 'class-validator';
import { ScheduleApprovalPolicy } from '@prisma/client';

export class HospitalApproveRefillRequestDto {
    @IsOptional()
    @IsEnum(ScheduleApprovalPolicy)
    approvalPolicy?: ScheduleApprovalPolicy;
}
