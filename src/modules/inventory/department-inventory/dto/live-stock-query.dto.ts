import { IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class LiveStockQueryDto extends PaginationDto {
    @IsUUID()
    departmentId!: string;
}
