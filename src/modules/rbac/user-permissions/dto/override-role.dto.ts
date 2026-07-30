import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class OverrideRoleDto {
    @IsUUID()
    sourceRoleId!: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}
