import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PermissionEffect } from '@prisma/client';

export class UpsertUserPermissionDto {
  @IsString()
  permissionCode!: string;

  @IsEnum(PermissionEffect)
  effect!: PermissionEffect;

  @IsOptional()
  @IsString()
  reason?: string;
}
