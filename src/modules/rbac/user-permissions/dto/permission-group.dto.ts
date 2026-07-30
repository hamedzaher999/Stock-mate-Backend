import { PermissionEffect } from '@prisma/client';
import {
    ArrayNotEmpty,
    IsArray,
    IsEnum,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';
export class PermissionGroupDto {
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    permissionCodes!: string[];

    @IsEnum(PermissionEffect)
    effect!: PermissionEffect;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}
