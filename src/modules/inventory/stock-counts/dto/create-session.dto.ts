import {
    IsDateString,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
} from 'class-validator';

export class CreateStockCountSessionDto {
    @IsUUID()
    departmentId!: string;

    @IsDateString()
    countDate!: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}
