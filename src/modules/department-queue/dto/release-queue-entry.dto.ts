import { IsOptional, IsString } from 'class-validator';

export class ReleaseQueueEntryDto {
    @IsOptional()
    @IsString()
    reason?: string;
}
