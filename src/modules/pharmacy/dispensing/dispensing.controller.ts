import { Body, Controller, Post } from '@nestjs/common';
import { DispensingService } from './dispensing.service';
import { DispensePrescriptionDto } from './dto/dispense-prescription.dto';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { Throttle } from '@nestjs/throttler';

@Controller('pharmacy/dispensing')
@RequirePermissions(PERMISSIONS.DISPENSE_PRESCRIPTION)
export class DispensingController {
    constructor(private readonly dispensingService: DispensingService) {}

    @Post()
    @Throttle({ default: { limit: 10, ttl: 60000 } })
    async dispense(
        @Body() dto: DispensePrescriptionDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.dispensingService.dispense(dto, user.sub);
        return { message: 'تم صرف الوصفة الطبية.', data };
    }
}
