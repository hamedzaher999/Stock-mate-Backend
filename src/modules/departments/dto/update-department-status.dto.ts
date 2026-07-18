import { IsBoolean } from 'class-validator';

export class UpdateDepartmentStatusDto {
    @IsBoolean()
    isActive!: boolean;
}
