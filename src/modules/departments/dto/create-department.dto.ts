import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { DepartmentType } from '@prisma/client';

export class CreateDepartmentDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsEnum(DepartmentType)
  type!: DepartmentType;

  @IsOptional()
  @IsUUID()
  managerId?: string;
}
