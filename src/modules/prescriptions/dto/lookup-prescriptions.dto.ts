import { IsOptional, IsString } from 'class-validator';

export class LookupPrescriptionsDto {
    @IsOptional()
    @IsString()
    nationalId?: string;

    @IsOptional()
    @IsString()
    familyBookNumber?: string;
}
