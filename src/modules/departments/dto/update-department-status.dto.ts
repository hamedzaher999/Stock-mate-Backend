import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateDepartmentStatusDto {
    @IsBoolean()
    isActive!: boolean;
    @IsBoolean()
    @IsOptional()
    hasQueue?: boolean;
}
