import { IsString, MaxLength, MinLength } from 'class-validator';

export class RemoveAllQueueEntriesDto {
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    removedReason!: string;
}
