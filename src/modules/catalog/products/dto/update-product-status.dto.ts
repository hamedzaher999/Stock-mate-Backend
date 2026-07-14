import { IsBoolean } from 'class-validator';

export class UpdateProductStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
