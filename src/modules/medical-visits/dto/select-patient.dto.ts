import { IsUUID } from 'class-validator';

export class SelectPatientDto {
    @IsUUID()
    queueEntryId!: string;
}
