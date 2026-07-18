import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsNumber,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';

class CommitteeItemApprovalDto {
    @IsUUID()
    purchaseRequestItemId!: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    approvedQuantity!: number;
}

export class CommitteeApproveDto {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CommitteeItemApprovalDto)
    items!: CommitteeItemApprovalDto[];
}
