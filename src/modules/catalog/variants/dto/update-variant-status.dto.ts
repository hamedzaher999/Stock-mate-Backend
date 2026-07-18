import { IsBoolean } from 'class-validator';

export class UpdateVariantStatusDto {
    @IsBoolean()
    isActive!: boolean;
}
