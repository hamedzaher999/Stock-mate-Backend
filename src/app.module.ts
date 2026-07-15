import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './core/prisma/prisma.module';
import { CacheModule } from './core/cache/cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { JwtAuthGuard } from './core/guards/jwt-auth.guard';
import { PermissionsGuard } from './core/guards/permissions.guard';
import { TransformResponseInterceptor } from './core/interceptors/transform-response.interceptor';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { validationSchema } from './config/validation.schema';
import { AppController } from './app.controller';
import { UsersModule } from './modules/users/users.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { StockSettingsModule } from './modules/stock-settings/stock-settings.module';
import { PurchasingModule } from './modules/purchasing/purchasing.module';
import { BatchesModule } from './modules/batches/batches.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 30,
      },
    ]),
    CacheModule,
    PrismaModule,
    AuthModule,
    RbacModule,
    UsersModule,
    DepartmentsModule,
    SuppliersModule,
    CatalogModule,
    StockSettingsModule,
    PurchasingModule,
    BatchesModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
