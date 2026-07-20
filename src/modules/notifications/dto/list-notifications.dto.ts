import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { NotificationCategory } from '@prisma/client';

export class ListNotificationsDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number;

    @IsOptional()
    @IsIn(['true', 'false'])
    isRead?: string;

    @IsOptional()
    @IsEnum(NotificationCategory)
    category?: NotificationCategory;
}
