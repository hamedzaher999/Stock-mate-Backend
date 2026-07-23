import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { DepartmentsRepository } from './departments.repository';
import { DepartmentsCacheService } from './departments-cache.service';
@Module({
    controllers: [DepartmentsController],
    providers: [
        DepartmentsService,
        DepartmentsRepository,
        DepartmentsCacheService,
    ],
    exports: [DepartmentsRepository, DepartmentsCacheService],
})
export class DepartmentsModule {}
