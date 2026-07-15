import { IsString, MinLength } from 'class-validator';

export class CommitteeRejectDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}
