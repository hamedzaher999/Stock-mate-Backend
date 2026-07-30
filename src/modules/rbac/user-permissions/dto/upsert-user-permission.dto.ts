import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PermissionEffect } from '@prisma/client';
export class UpsertUserPermissionDto {
    @IsString()
    @MaxLength(100)
    permissionCode!: string;

    @IsEnum(PermissionEffect)
    effect!: PermissionEffect;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}
