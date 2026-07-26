import { Controller, Get, Param, Query } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { ListBatchesDto } from './dto/list-batches.dto';
import { RequirePermissions } from '../../core/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions.constants';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-request.interface';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
@Controller('batches')
export class BatchesController {
    constructor(private readonly batchesService: BatchesService) {}

    @Get()
    @RequirePermissions(PERMISSIONS.VIEW_INVENTORY)
    async findAll(
        @Query() query: ListBatchesDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.batchesService.list(query, user.sub);
        return { message: 'Success', data };
    }

    @Get(':id')
    @RequirePermissions(PERMISSIONS.VIEW_INVENTORY)
    async findOne(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.batchesService.findById(id, user.sub);
        return { message: 'Success', data };
    }
}
