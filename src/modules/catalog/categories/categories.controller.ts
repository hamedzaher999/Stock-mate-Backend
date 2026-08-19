import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';

@Controller('catalog/categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) {}

    @Get()
    async findAll() {
        const data = await this.categoriesService.findAll();
        return { message: 'تم جلب البيانات بنجاح.', data };
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const data = await this.categoriesService.findById(id);
        return { message: 'تم جلب البيانات بنجاح.', data };
    }

    @Post()
    @RequirePermissions(PERMISSIONS.MANAGE_CATEGORIES)
    async create(@Body() dto: CreateCategoryDto) {
        const data = await this.categoriesService.create(dto);
        return { message: 'تم إنشاء الفئة بنجاح.', data };
    }

    @Patch(':id')
    @RequirePermissions(PERMISSIONS.MANAGE_CATEGORIES)
    async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
        const data = await this.categoriesService.update(id, dto);
        return { message: 'تم تحديث الفئة بنجاح.', data };
    }

    @Delete(':id')
    @RequirePermissions(PERMISSIONS.MANAGE_CATEGORIES)
    async remove(@Param('id') id: string) {
        await this.categoriesService.delete(id);
        return { message: 'تم حذف الفئة بنجاح.', data: null };
    }
}
