import { IsUUID } from 'class-validator';

export class LiveStockQueryDto {
  @IsUUID()
  departmentId!: string;
}
