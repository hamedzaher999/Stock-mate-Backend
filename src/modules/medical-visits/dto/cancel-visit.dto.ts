import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelVisitDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    reason!: string;
}
