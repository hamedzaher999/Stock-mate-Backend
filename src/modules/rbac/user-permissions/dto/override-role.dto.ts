import { IsOptional, IsString, IsUUID } from 'class-validator';

export class OverrideRoleDto {
    @IsUUID()
    sourceRoleId!: string;

    @IsOptional()
    @IsString()
    reason?: string;
}
