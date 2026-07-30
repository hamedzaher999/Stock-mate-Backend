import { PermissionEffect } from '@prisma/client';
import {
    ArrayMaxSize,
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
    @ArrayMaxSize(300)
    @IsString({ each: true })
    @MaxLength(100, { each: true })
    permissionCodes!: string[];

    @IsEnum(PermissionEffect)
    effect!: PermissionEffect;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}
