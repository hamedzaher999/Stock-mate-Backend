import { IsUUID } from 'class-validator';

export class LiveQueueQueryDto {
  @IsUUID()
  departmentId!: string;
}
