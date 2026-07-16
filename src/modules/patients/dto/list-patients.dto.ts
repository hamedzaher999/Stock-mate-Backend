import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListPatientsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string; // for fullName, nationalId, familyBookNumber, patientId
}
