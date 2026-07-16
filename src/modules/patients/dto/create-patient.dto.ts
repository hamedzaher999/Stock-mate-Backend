import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePatientDto {
  @IsString()
  @MaxLength(150)
  fullName!: string;

  @IsOptional()
  @Matches(/^\d{11}$/, { message: 'nationalId must be exactly 11 digits.' })
  nationalId?: string;

  @IsOptional()
  @Matches(/^\d+$/, { message: 'familyBookNumber must contain digits only.' })
  familyBookNumber?: string;
}
