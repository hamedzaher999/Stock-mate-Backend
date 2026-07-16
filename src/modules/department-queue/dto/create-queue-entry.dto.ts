import { IsUUID } from 'class-validator';

export class CreateQueueEntryDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  departmentId!: string;
}
