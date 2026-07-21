import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PurchaseReceivingService } from './purchase-receiving.service';
import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto';
import { ListPurchaseReceiptsDto } from './dto/list-purchase-receipts.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { ConfirmPurchaseReceiptDto } from './dto/confirm-purchase-receipt.dto';
@Controller('purchasing/receipts')
export class PurchaseReceivingController {
    constructor(
        private readonly purchaseReceivingService: PurchaseReceivingService,
    ) {}

    @Get()
    @RequirePermissions(PERMISSIONS.VIEW_PURCHASING_HISTORY)
    async findAll(@Query() query: ListPurchaseReceiptsDto) {
        const data = await this.purchaseReceivingService.list(query);
        return { message: 'Success', data };
    }

    @Get(':id')
    @RequirePermissions(PERMISSIONS.VIEW_PURCHASING_HISTORY)
    async findOne(@Param('id') id: string) {
        const data = await this.purchaseReceivingService.findById(id);
        return { message: 'Success', data };
    }

    @Post()
    @RequirePermissions(PERMISSIONS.RECEIVE_PURCHASE)
    async create(
        @Body() dto: CreatePurchaseReceiptDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.purchaseReceivingService.create(dto, user.sub);
        return {
            message:
                'Purchase receipt recorded. Awaiting warehouse confirmation.',
            data,
        };
    }

    @Post(':id/confirm')
    @RequirePermissions(PERMISSIONS.CONFIRM_PURCHASE_RECEIPT)
    async confirm(
        @Param('id') id: string,
        @Body() dto: ConfirmPurchaseReceiptDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.purchaseReceivingService.confirm(
            id,
            dto,
            user.sub,
        );
        return {
            message: 'Purchase receipt confirmed and warehouse stock updated.',
            data,
        };
    }
}
