import {
    ArrayMaxSize,
    ArrayUnique,
    IsArray,
    IsString,
    MaxLength,
} from 'class-validator';

export class SetRolePermissionsDto {
    @IsArray()
    @ArrayUnique()
    @ArrayMaxSize(300)
    @IsString({ each: true })
    @MaxLength(100, { each: true })
    permissionCodes!: string[];
}
