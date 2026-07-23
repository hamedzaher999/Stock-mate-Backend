import { PermissionEffect } from '@prisma/client';
import {
    ArrayNotEmpty,
    IsArray,
    IsEnum,
    IsOptional,
    IsString,
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
    reason?: string;
}
