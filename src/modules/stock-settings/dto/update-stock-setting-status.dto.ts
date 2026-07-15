import { IsBoolean } from 'class-validator';

export class UpdateStockSettingStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
