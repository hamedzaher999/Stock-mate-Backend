import { IsOptional, IsString } from 'class-validator';

export class LookupPatientDto {
  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsString()
  familyBookNumber?: string;

  @IsOptional()
  @IsString()
  patientId?: string;
}
