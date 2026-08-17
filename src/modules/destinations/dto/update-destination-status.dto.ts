import { IsBoolean } from 'class-validator';

export class UpdateDestinationStatusDto {
    @IsBoolean()
    isActive!: boolean;
}
