import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelPeriodicScheduleDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    reason!: string;
}
