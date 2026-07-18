import { Controller, Get } from '@nestjs/common';
import { Public } from './core/decorators/public.decorator';

@Controller()
export class AppController {
    @Public()
    @Get()
    getRoot() {
        return { message: 'Red Crescent Hospital API', data: { status: 'ok' } };
    }
}
