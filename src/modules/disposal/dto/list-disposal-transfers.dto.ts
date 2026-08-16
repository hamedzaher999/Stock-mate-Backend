import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { DisposalTransferStatus } from '@prisma/client';

export class ListDisposalTransfersDto extends PaginationDto {
    @IsOptional()
    @IsUUID()
    departmentId?: string;

    @IsOptional()
    @IsEnum(DisposalTransferStatus)
    status?: DisposalTransferStatus;
}
