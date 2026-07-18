import { Body, Controller, Post } from '@nestjs/common';
import { DispensingService } from './dispensing.service';
import { DispensePrescriptionDto } from './dto/dispense-prescription.dto';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('pharmacy/dispensing')
@RequirePermissions(PERMISSIONS.DISPENSE_PRESCRIPTION)
export class DispensingController {
    constructor(private readonly dispensingService: DispensingService) {}

    @Post()
    async dispense(
        @Body() dto: DispensePrescriptionDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.dispensingService.dispense(dto, user.sub);
        return { message: 'Prescription dispensed.', data };
    }
}
