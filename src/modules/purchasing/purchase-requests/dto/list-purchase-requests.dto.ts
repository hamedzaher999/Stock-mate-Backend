import { IsEnum, IsOptional } from 'class-validator';
import { RequestStatus } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class ListPurchaseRequestsDto extends PaginationDto {
    @IsOptional()
    @IsEnum(RequestStatus)
    status?: RequestStatus;
}
