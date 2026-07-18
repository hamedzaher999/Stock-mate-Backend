import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelPrescriptionDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    reason!: string;
}
