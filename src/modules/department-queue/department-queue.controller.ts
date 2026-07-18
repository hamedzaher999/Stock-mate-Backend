import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { DepartmentQueueService } from './department-queue.service';
import { CreateQueueEntryDto } from './dto/create-queue-entry.dto';
import { ReleaseQueueEntryDto } from './dto/release-queue-entry.dto';
import { RemoveQueueEntryDto } from './dto/remove-queue-entry.dto';
import { ListQueueDto } from './dto/list-queue.dto';
import { RequirePermissions } from '../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../common/constants/permissions.constants';

@Controller('department-queue')
export class DepartmentQueueController {
    constructor(
        private readonly departmentQueueService: DepartmentQueueService,
    ) {}

    @Get()
    async findAll(
        @Query() query: ListQueueDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.departmentQueueService.list(query, user.sub);
        return { message: 'Success', data };
    }

    @Get(':id')
    async findOne(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.departmentQueueService.findById(id, user.sub);
        return { message: 'Success', data };
    }

    @Post()
    @RequirePermissions(PERMISSIONS.MANAGE_DEPARTMENT_QUEUE)
    async create(
        @Body() dto: CreateQueueEntryDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.departmentQueueService.create(dto, user.sub);
        return { message: 'Patient added to the queue.', data };
    }

    @Patch(':id/release')
    async release(
        @Param('id') id: string,
        @Body() dto: ReleaseQueueEntryDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.departmentQueueService.release(
            id,
            dto,
            user.sub,
        );
        return { message: 'Patient released back to the waiting queue.', data };
    }

    @Patch(':id/remove')
    @RequirePermissions(PERMISSIONS.MANAGE_DEPARTMENT_QUEUE)
    async remove(
        @Param('id') id: string,
        @Body() dto: RemoveQueueEntryDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.departmentQueueService.remove(
            id,
            dto,
            user.sub,
        );
        return { message: 'Patient removed from the queue.', data };
    }
}
