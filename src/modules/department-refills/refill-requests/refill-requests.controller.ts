import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { RefillRequestsService } from './refill-requests.service';
import { CreateRefillRequestDto } from './dto/create-refill-request.dto';
import { UpdateRefillRequestDto } from './dto/update-refill-request.dto';
import { HospitalRejectDto } from './dto/hospital-reject.dto';
import { PrepareRefillRequestDto } from './dto/prepare-refill-request.dto';
import { ListRefillRequestsDto } from './dto/list-refill-requests.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { HospitalApproveRefillRequestDto } from './dto/hospital-approve-refill-request.dto';

@Controller('department-refills/requests')
export class RefillRequestsController {
    constructor(
        private readonly refillRequestsService: RefillRequestsService,
    ) {}

    @Get()
    @RequirePermissions(PERMISSIONS.CREATE_DEPARTMENT_REFILL_REQUEST)
    async findAll(
        @Query() query: ListRefillRequestsDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.refillRequestsService.list(query, user.sub);
        return { message: 'Success', data };
    }

    @Get(':id')
    @RequirePermissions(PERMISSIONS.CREATE_DEPARTMENT_REFILL_REQUEST)
    async findOne(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.refillRequestsService.findByIdForUser(
            id,
            user.sub,
        );
        return { message: 'Success', data };
    }

    @Post()
    @RequirePermissions(PERMISSIONS.CREATE_DEPARTMENT_REFILL_REQUEST)
    async create(
        @Body() dto: CreateRefillRequestDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.refillRequestsService.create(dto, user.sub);
        return { message: 'Refill request created.', data };
    }

    @Patch(':id')
    @RequirePermissions(PERMISSIONS.CREATE_DEPARTMENT_REFILL_REQUEST)
    async update(@Param('id') id: string, @Body() dto: UpdateRefillRequestDto) {
        const data = await this.refillRequestsService.update(id, dto);
        return { message: 'Refill request updated.', data };
    }

    @Post(':id/submit')
    @RequirePermissions(PERMISSIONS.CREATE_DEPARTMENT_REFILL_REQUEST)
    async submit(@Param('id') id: string) {
        const data = await this.refillRequestsService.submit(id);
        return {
            message: 'Refill request submitted for hospital approval.',
            data,
        };
    }

    @Post(':id/hospital-approve')
    @RequirePermissions(PERMISSIONS.APPROVE_DEPARTMENT_REFILL_REQUEST)
    async hospitalApprove(
        @Param('id') id: string,
        @Body() dto: HospitalApproveRefillRequestDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.refillRequestsService.hospitalApprove(
            id,
            dto,
            user.sub,
        );
        return { message: 'Refill request approved.', data };
    }

    @Post(':id/hospital-reject')
    @RequirePermissions(PERMISSIONS.APPROVE_DEPARTMENT_REFILL_REQUEST)
    async hospitalReject(
        @Param('id') id: string,
        @Body() dto: HospitalRejectDto,
    ) {
        const data = await this.refillRequestsService.hospitalReject(id, dto);
        return { message: 'Refill request rejected.', data };
    }
    @Post(':id/start-preparing')
    @RequirePermissions(PERMISSIONS.PREPARE_DEPARTMENT_REFILL)
    async startPreparing(@Param('id') id: string) {
        const data = await this.refillRequestsService.startPreparing(id);
        return { message: 'Refill request marked as preparing.', data };
    }
    @Post(':id/prepare')
    @RequirePermissions(PERMISSIONS.PREPARE_DEPARTMENT_REFILL)
    async prepare(
        @Param('id') id: string,
        @Body() dto: PrepareRefillRequestDto,
    ) {
        const data = await this.refillRequestsService.prepare(id, dto);
        return {
            message: 'Refill request prepared and marked ready for delivery.',
            data,
        };
    }

    @Post(':id/cancel')
    @RequirePermissions(PERMISSIONS.CREATE_DEPARTMENT_REFILL_REQUEST)
    async cancel(@Param('id') id: string) {
        const data = await this.refillRequestsService.cancel(id);
        return { message: 'Refill request cancelled.', data };
    }
}
