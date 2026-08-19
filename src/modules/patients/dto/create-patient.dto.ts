import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePatientDto {
    @IsString()
    @MaxLength(150)
    fullName!: string;

    @IsOptional()
    @Matches(/^\d{11}$/, {
        message: 'يجب أن يتكون الرقم الوطني من 11 رقماً بالضبط.',
    })
    nationalId?: string;

    @IsOptional()
    @MaxLength(50)
    @Matches(/^\d+$/, {
        message: 'يجب أن يحتوي رقم دفتر العائلة على أرقام فقط.',
    })
    familyBookNumber?: string;
}
