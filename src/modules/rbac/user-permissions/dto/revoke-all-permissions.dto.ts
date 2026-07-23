import { IsOptional, IsString } from 'class-validator';

export class RevokeAllPermissionsDto {
    @IsOptional()
    @IsString()
    reason?: string;
}
