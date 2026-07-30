import { IsString, MaxLength, MinLength } from 'class-validator';
export class RemoveQueueEntryDto {
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    removedReason!: string;
}
