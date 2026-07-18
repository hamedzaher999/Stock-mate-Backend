import { IsBooleanString, IsEnum, IsOptional, IsString } from 'class-validator';
import { DepartmentType } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListDepartmentsDto extends PaginationDto {
    @IsOptional()
    @IsEnum(DepartmentType)
    type?: DepartmentType;

    @IsOptional()
    @IsBooleanString()
    isActive?: string;

    @IsOptional()
    @IsString()
    search?: string;
}
