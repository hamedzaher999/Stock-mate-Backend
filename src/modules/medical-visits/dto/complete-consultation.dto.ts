import {
    IsArray,
    IsDateString,
    IsEnum,
    IsInt,
    IsOptional,
    IsPositive,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FrequencyUnit } from '@prisma/client';

class PrescriptionItemInputDto {
    @IsUUID()
    variantId!: string;

    @IsPositive()
    prescribedQuantity!: number;

    @IsOptional()
    @IsString()
    dosage?: string;

    @IsOptional()
    @IsString()
    frequency?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    durationDays?: number;
}

class PrescriptionInputDto {
    @IsOptional()
    @IsEnum(FrequencyUnit)
    frequencyUnit?: FrequencyUnit;

    @IsOptional()
    @IsInt()
    @Min(1)
    frequencyInterval?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    totalCycles?: number;

    @IsDateString()
    startDate!: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PrescriptionItemInputDto)
    items!: PrescriptionItemInputDto[];
}

export class CompleteConsultationDto {
    @IsUUID()
    queueEntryId!: string;

    @IsOptional()
    @IsString()
    clinicalNotes?: string;

    @IsOptional()
    @IsString()
    diagnosis?: string;

    @IsOptional()
    @IsString()
    externalMedications?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PrescriptionInputDto)
    prescriptions?: PrescriptionInputDto[];
}
