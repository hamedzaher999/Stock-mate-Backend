import { IsString, MinLength } from 'class-validator';

export class RemoveQueueEntryDto {
    @IsString()
    @MinLength(3)
    removedReason!: string;
}
