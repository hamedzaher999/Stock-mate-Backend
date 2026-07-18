import { Module } from '@nestjs/common';
import { UnitsController } from './units/units.controller';
import { UnitsService } from './units/units.service';
import { UnitsRepository } from './units/units.repository';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import { CategoriesRepository } from './categories/categories.repository';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { ProductsRepository } from './products/products.repository';
import { VariantsController } from './variants/variants.controller';
import { VariantsService } from './variants/variants.service';
import { VariantsRepository } from './variants/variants.repository';

@Module({
    controllers: [
        UnitsController,
        CategoriesController,
        ProductsController,
        VariantsController,
    ],
    providers: [
        UnitsService,
        UnitsRepository,
        CategoriesService,
        CategoriesRepository,
        ProductsService,
        ProductsRepository,
        VariantsService,
        VariantsRepository,
    ],
    exports: [VariantsRepository, ProductsRepository],
})
export class CatalogModule {}
