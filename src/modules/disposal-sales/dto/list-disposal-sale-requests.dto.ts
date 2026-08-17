import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { DisposalSaleRequestStatus } from '@prisma/client';

export class ListDisposalSaleRequestsDto extends PaginationDto {
    @IsOptional()
    @IsUUID()
    destinationId?: string;

    @IsOptional()
    @IsEnum(DisposalSaleRequestStatus)
    status?: DisposalSaleRequestStatus;
}
