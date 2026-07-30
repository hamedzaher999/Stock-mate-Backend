import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectRequestDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(1000)
    reason!: string;
}
