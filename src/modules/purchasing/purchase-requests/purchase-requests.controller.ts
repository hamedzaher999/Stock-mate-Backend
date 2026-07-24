import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { PurchaseRequestsService } from './purchase-requests.service';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';
import { ApprovePurchaseRequestDto } from './dto/approve-purchase-request.dto';
import { RejectRequestDto } from '../../../common/dto/reject-request.dto';
import { ListPurchaseRequestsDto } from './dto/list-purchase-requests.dto';

@Controller('purchasing/requests')
export class PurchaseRequestsController {
    constructor(
        private readonly purchaseRequestsService: PurchaseRequestsService,
    ) {}

    @Get()
    @RequirePermissions(PERMISSIONS.VIEW_PURCHASING_HISTORY)
    async findAll(
        @Query() query: ListPurchaseRequestsDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.purchaseRequestsService.list(query, user.sub);
        return { message: 'Success', data };
    }

    @Get(':id')
    @RequirePermissions(PERMISSIONS.VIEW_PURCHASING_HISTORY)
    async findOne(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.purchaseRequestsService.findByIdForUser(
            id,
            user.sub,
        );
        return { message: 'Success', data };
    }

    @Post()
    @RequirePermissions(PERMISSIONS.CREATE_PURCHASE_REQUEST)
    async create(
        @Body() dto: CreatePurchaseRequestDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.purchaseRequestsService.create(dto, user.sub);
        return { message: 'Purchase request created.', data };
    }

    @Patch(':id')
    @RequirePermissions(PERMISSIONS.CREATE_PURCHASE_REQUEST)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdatePurchaseRequestDto,
    ) {
        const data = await this.purchaseRequestsService.update(id, dto);
        return { message: 'Purchase request updated.', data };
    }

    @Post(':id/submit')
    @RequirePermissions(PERMISSIONS.CREATE_PURCHASE_REQUEST)
    async submit(@Param('id') id: string) {
        const data = await this.purchaseRequestsService.submit(id);
        return {
            message: 'Purchase request submitted for hospital approval.',
            data,
        };
    }

    @Post(':id/hospital-approve')
    @RequirePermissions(PERMISSIONS.APPROVE_PURCHASE_REQUEST_HOSPITAL)
    async hospitalApprove(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.purchaseRequestsService.hospitalApprove(
            id,
            user.sub,
        );
        return {
            message: 'Approved and forwarded to the purchasing manager.',
            data,
        };
    }

    @Post(':id/hospital-reject')
    @RequirePermissions(PERMISSIONS.APPROVE_PURCHASE_REQUEST_HOSPITAL)
    async hospitalReject(
        @Param('id') id: string,
        @Body() dto: RejectRequestDto,
    ) {
        const data = await this.purchaseRequestsService.hospitalReject(id, dto);
        return { message: 'Purchase request rejected.', data };
    }

    @Post(':id/approve')
    @RequirePermissions(PERMISSIONS.APPROVE_PURCHASE_REQUEST_MANAGER)
    async approve(
        @Param('id') id: string,
        @Body() dto: ApprovePurchaseRequestDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.purchaseRequestsService.approve(
            id,
            dto,
            user.sub,
        );
        return { message: 'Purchase request approved.', data };
    }

    @Post(':id/reject')
    @RequirePermissions(PERMISSIONS.APPROVE_PURCHASE_REQUEST_MANAGER)
    async reject(
        @Param('id') id: string,
        @Body() dto: RejectRequestDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.purchaseRequestsService.reject(
            id,
            dto,
            user.sub,
        );
        return { message: 'Purchase request rejected.', data };
    }

    @Post(':id/complete')
    @RequirePermissions(PERMISSIONS.APPROVE_PURCHASE_REQUEST_MANAGER)
    async complete(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.purchaseRequestsService.complete(id, user.sub);
        return { message: 'Purchase request marked as complete.', data };
    }

    @Post(':id/cancel')
    @RequirePermissions(PERMISSIONS.CREATE_PURCHASE_REQUEST)
    async cancel(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.purchaseRequestsService.cancel(id, user.sub);
        return { message: 'Purchase request cancelled.', data };
    }
}
