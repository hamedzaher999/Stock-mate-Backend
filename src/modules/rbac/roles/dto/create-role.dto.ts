import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'name must be lowercase snake_case, e.g. "lab_technician"',
  })
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
