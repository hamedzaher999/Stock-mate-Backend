import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { NotificationCategory } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
export class ListNotificationsDto extends PaginationDto {
    @IsOptional()
    @IsIn(['true', 'false'])
    isRead?: string;

    @IsOptional()
    @IsEnum(NotificationCategory)
    category?: NotificationCategory;
}
