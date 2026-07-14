import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { UpdateDepartmentStatusDto } from './dto/update-department-status.dto';
import { ListDepartmentsDto } from './dto/list-departments.dto';
import { RequirePermissions } from '../../core/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions.constants';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  async findAll(@Query() query: ListDepartmentsDto) {
    const data = await this.departmentsService.list(query);
    return { message: 'Success', data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.departmentsService.findById(id);
    return { message: 'Success', data };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MANAGE_DEPARTMENTS)
  async create(@Body() dto: CreateDepartmentDto) {
    const data = await this.departmentsService.create(dto);
    return { message: 'Department created.', data };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.MANAGE_DEPARTMENTS)
  async update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    const data = await this.departmentsService.update(id, dto);
    return { message: 'Department updated.', data };
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.MANAGE_DEPARTMENTS)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentStatusDto,
  ) {
    const data = await this.departmentsService.updateStatus(id, dto);
    return {
      message: `Department marked as ${dto.isActive ? 'active' : 'inactive'}.`,
      data,
    };
  }

  @Patch(':id/manager')
  @RequirePermissions(PERMISSIONS.MANAGE_DEPARTMENTS)
  async assignManager(@Param('id') id: string, @Body() dto: AssignManagerDto) {
    const data = await this.departmentsService.assignManager(id, dto);
    return { message: 'Department manager updated.', data };
  }
}
