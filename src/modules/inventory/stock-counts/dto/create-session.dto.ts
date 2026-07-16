import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateStockCountSessionDto {
  @IsUUID()
  departmentId!: string;

  @IsDateString()
  countDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
