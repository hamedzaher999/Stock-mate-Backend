import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { DisposalService } from './disposal.service';
import { RequirePermissions } from '../../core/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions.constants';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-request.interface';
import { ListDisposalTransfersDto } from './dto/list-disposal-transfers.dto';
import { ConfirmDisposalTransferDto } from './dto/confirm-disposal-transfer.dto';
import { CancelDisposalTransferDto } from './dto/cancel-disposal-transfer.dto';

@Controller('disposal')
export class DisposalController {
    constructor(private readonly disposalService: DisposalService) {}

    @Get('departments/:departmentId/candidates')
    @RequirePermissions(PERMISSIONS.VIEW_DISPOSAL)
    async candidates(@Param('departmentId') departmentId: string) {
        const data = await this.disposalService.getCandidates(departmentId);
        return { message: 'Success', data };
    }

    @Get('transfers')
    @RequirePermissions(PERMISSIONS.VIEW_DISPOSAL)
    async findAll(@Query() query: ListDisposalTransfersDto) {
        const data = await this.disposalService.list(query);
        return { message: 'Success', data };
    }

    @Get('transfers/:id')
    @RequirePermissions(PERMISSIONS.VIEW_DISPOSAL)
    async findOne(@Param('id') id: string) {
        const data = await this.disposalService.findById(id);
        return { message: 'Success', data };
    }

    @Post('transfers/departments/:departmentId')
    @RequirePermissions(PERMISSIONS.MANAGE_DISPOSAL_TRANSFERS)
    async initiate(
        @Param('departmentId') departmentId: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.disposalService.initiate(
            departmentId,
            user.sub,
        );
        return { message: 'Disposal transfer initiated.', data };
    }

    @Post('transfers/:id/confirm')
    @RequirePermissions(PERMISSIONS.MANAGE_DISPOSAL_TRANSFERS)
    async confirm(
        @Param('id') id: string,
        @Body() dto: ConfirmDisposalTransferDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.disposalService.confirm(id, dto, user.sub);
        return { message: 'Disposal transfer confirmed.', data };
    }

    @Post('transfers/:id/cancel')
    @RequirePermissions(PERMISSIONS.MANAGE_DISPOSAL_TRANSFERS)
    async cancel(
        @Param('id') id: string,
        @Body() dto: CancelDisposalTransferDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.disposalService.cancel(id, dto, user.sub);
        return { message: 'Disposal transfer cancelled.', data };
    }
}
