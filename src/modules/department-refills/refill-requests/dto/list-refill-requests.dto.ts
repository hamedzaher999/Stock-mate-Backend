import { IsEnum, IsOptional } from 'class-validator';
import { RefillRequestStatus } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class ListRefillRequestsDto extends PaginationDto {
    @IsOptional()
    @IsEnum(RefillRequestStatus)
    status?: RefillRequestStatus;
}
