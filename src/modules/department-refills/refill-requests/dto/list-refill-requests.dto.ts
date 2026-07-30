import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
    RefillRequestPriority,
    RefillRequestType,
    RequestStatus,
} from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
export class ListRefillRequestsDto extends PaginationDto {
    @IsOptional()
    @IsEnum(RequestStatus)
    status?: RequestStatus;

    @IsOptional()
    @IsUUID()
    departmentId?: string;

    @IsOptional()
    @IsEnum(RefillRequestPriority)
    priority?: RefillRequestPriority;

    @IsOptional()
    @IsEnum(RefillRequestType)
    requestType?: RefillRequestType;
}
