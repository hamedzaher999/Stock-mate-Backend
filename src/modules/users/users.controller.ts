import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { RequirePermissions } from '../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../common/constants/permissions.constants';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get('me')
    async me(@CurrentUser() user: AuthenticatedUser) {
        const data = await this.usersService.getWithPermissions(user.sub);
        return { message: 'Success', data };
    }

    @Patch('me')
    async updateMe(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: UpdateMeDto,
    ) {
        const data = await this.usersService.updateMe(user.sub, dto);
        return { message: 'Profile updated.', data };
    }

    @Get()
    @RequirePermissions(PERMISSIONS.MANAGE_ACCOUNTS)
    async findAll(@Query() query: ListUsersDto) {
        const data = await this.usersService.list(query);
        return { message: 'Success', data };
    }

    @Get(':id')
    @RequirePermissions(PERMISSIONS.MANAGE_ACCOUNTS)
    async findOne(@Param('id') id: string) {
        const data = await this.usersService.getWithPermissions(id);
        return { message: 'Success', data };
    }

    @Post()
    @RequirePermissions(PERMISSIONS.MANAGE_ACCOUNTS)
    async create(
        @Body() dto: CreateUserDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.usersService.create(dto, user.sub);
        return { message: 'User created.', data };
    }

    @Patch(':id')
    @RequirePermissions(PERMISSIONS.MANAGE_ACCOUNTS)
    async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
        const data = await this.usersService.update(id, dto);
        return { message: 'User updated.', data };
    }

    @Patch(':id/status')
    @RequirePermissions(PERMISSIONS.MANAGE_ACCOUNTS)
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateUserStatusDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.usersService.updateStatus(id, dto, user.sub);
        return { message: `User marked as ${dto.status}.`, data };
    }
}
