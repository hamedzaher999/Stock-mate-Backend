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
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { CreateRefillRequestDto } from './dto/create-refill-request.dto';
import { UpdateRefillRequestDto } from './dto/update-refill-request.dto';
import { ApproveRefillRequestDto } from './dto/approve-refill-request.dto';
import { ListRefillRequestsDto } from './dto/list-refill-requests.dto';
import { RejectRequestDto } from '../../../common/dto/reject-request.dto';
import { Throttle } from '@nestjs/throttler';
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

    @Get(':id/items/:itemId')
    @RequirePermissions(PERMISSIONS.CREATE_DEPARTMENT_REFILL_REQUEST)
    async findItem(
        @Param('id') id: string,
        @Param('itemId') itemId: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.refillRequestsService.getItem(
            id,
            itemId,
            user.sub,
        );
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
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateRefillRequestDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.refillRequestsService.update(id, dto, user.sub);
        return { message: 'Refill request updated.', data };
    }

    @Post(':id/submit')
    @RequirePermissions(PERMISSIONS.CREATE_DEPARTMENT_REFILL_REQUEST)
    async submit(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.refillRequestsService.submit(id, user.sub);
        return {
            message: 'Refill request submitted for hospital approval.',
            data,
        };
    }

    @Post(':id/hospital-approve')
    @Throttle({ default: { limit: 20, ttl: 60000 } })
    @RequirePermissions(PERMISSIONS.APPROVE_DEPARTMENT_REFILL_REQUEST_HOSPITAL)
    async hospitalApprove(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.refillRequestsService.hospitalApprove(
            id,
            user.sub,
        );
        return {
            message: 'Approved and forwarded to the warehouse manager.',
            data,
        };
    }

    @Post(':id/hospital-reject')
    @Throttle({ default: { limit: 20, ttl: 60000 } })
    @RequirePermissions(PERMISSIONS.APPROVE_DEPARTMENT_REFILL_REQUEST_HOSPITAL)
    async hospitalReject(
        @Param('id') id: string,
        @Body() dto: RejectRequestDto,
    ) {
        const data = await this.refillRequestsService.hospitalReject(id, dto);
        return { message: 'Refill request rejected.', data };
    }

    @Post(':id/approve')
    @Throttle({ default: { limit: 20, ttl: 60000 } })
    @RequirePermissions(PERMISSIONS.APPROVE_DEPARTMENT_REFILL_REQUEST_MANAGER)
    async approve(
        @Param('id') id: string,
        @Body() dto: ApproveRefillRequestDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.refillRequestsService.approve(
            id,
            dto,
            user.sub,
        );
        return { message: 'Refill request approved.', data };
    }

    @Post(':id/reject')
    @Throttle({ default: { limit: 20, ttl: 60000 } })
    @RequirePermissions(PERMISSIONS.APPROVE_DEPARTMENT_REFILL_REQUEST_MANAGER)
    async reject(
        @Param('id') id: string,
        @Body() dto: RejectRequestDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.refillRequestsService.reject(id, dto, user.sub);
        return { message: 'Refill request rejected.', data };
    }

    @Post(':id/complete')
    @Throttle({ default: { limit: 20, ttl: 60000 } })
    @RequirePermissions(PERMISSIONS.APPROVE_DEPARTMENT_REFILL_REQUEST_MANAGER)
    async complete(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.refillRequestsService.complete(id, user.sub);
        return { message: 'Refill request marked as complete.', data };
    }

    @Post(':id/cancel')
    @Throttle({ default: { limit: 20, ttl: 60000 } })
    @RequirePermissions(PERMISSIONS.CREATE_DEPARTMENT_REFILL_REQUEST)
    async cancel(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.refillRequestsService.cancel(id, user.sub);
        return { message: 'Refill request cancelled.', data };
    }
}
