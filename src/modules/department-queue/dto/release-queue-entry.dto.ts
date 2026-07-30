import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReleaseQueueEntryDto {
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}
