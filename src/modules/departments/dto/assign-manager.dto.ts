import { IsOptional, IsUUID } from 'class-validator';

export class AssignManagerDto {
  @IsOptional()
  @IsUUID()
  managerId?: string | null;
}
