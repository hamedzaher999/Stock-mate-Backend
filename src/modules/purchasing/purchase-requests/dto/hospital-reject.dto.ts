import { IsString, MinLength } from 'class-validator';

export class HospitalRejectDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}
