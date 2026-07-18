import { IsOptional, IsString } from 'class-validator';

export class LookupDispenseQueueDto {
    @IsOptional()
    @IsString()
    nationalId?: string;

    @IsOptional()
    @IsString()
    familyBookNumber?: string;
}
