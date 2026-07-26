import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { RbacModule } from '../rbac/rbac.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [RbacModule, AuthModule],
    controllers: [UsersController],
    providers: [UsersService, UsersRepository],
    exports: [UsersRepository],
})
export class UsersModule {}
