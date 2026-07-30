import { IsEnum, IsOptional } from 'class-validator';
import { RefillRequestPriority, RequestStatus } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class ListPurchaseRequestsDto extends PaginationDto {
    @IsOptional()
    @IsEnum(RequestStatus)
    status?: RequestStatus;

    @IsOptional()
    @IsEnum(RefillRequestPriority)
    priority?: RefillRequestPriority;
}
