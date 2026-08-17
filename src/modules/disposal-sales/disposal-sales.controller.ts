import {
    Body,
    Controller,
    Get,
    HttpStatus,
    Param,
    ParseFilePipeBuilder,
    Post,
    Query,
    UploadedFiles,
    UseInterceptors,
} from '@nestjs/common';
import { DisposalSalesService } from './disposal-sales.service';
import { PERMISSIONS } from '../../common/constants/permissions.constants';
import { RequirePermissions } from '../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-request.interface';
import { ListDisposalSaleRequestsDto } from './dto/list-disposal-sale-requests.dto';
import { CreateDisposalSaleRequestDto } from './dto/create-disposal-sale-request.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { RejectRequestDto } from '../../common/dto/reject-request.dto';

const DISPOSAL_SALE_IMAGE_UPLOAD_HARD_CEILING = 30;

@Controller('disposal/sales')
export class DisposalSalesController {
    constructor(private readonly disposalSalesService: DisposalSalesService) {}

    @Get('live-stock')
    @RequirePermissions(PERMISSIONS.VIEW_DISPOSAL)
    async liveStock(
        @Query('page') page: number,
        @Query('limit') limit: number,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.disposalSalesService.getWarehouseLiveStock(
            user.sub,
            page,
            limit,
        );
        return { message: 'Success', data };
    }

    @Get()
    @RequirePermissions(PERMISSIONS.VIEW_DISPOSAL)
    async findAll(@Query() query: ListDisposalSaleRequestsDto) {
        const data = await this.disposalSalesService.list(query);
        return { message: 'Success', data };
    }

    @Get(':id')
    @RequirePermissions(PERMISSIONS.VIEW_DISPOSAL)
    async findOne(@Param('id') id: string) {
        const data = await this.disposalSalesService.findById(id);
        return { message: 'Success', data };
    }

    @Post()
    @RequirePermissions(PERMISSIONS.CREATE_DISPOSAL_SALE_REQUEST)
    async create(
        @Body() dto: CreateDisposalSaleRequestDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.disposalSalesService.create(dto, user.sub);
        return {
            message: 'تم إنشاء طلب بيع الهالك. بانتظار موافقة مدير المستشفى.',
            data,
        };
    }

    @Post(':id/approve')
    @RequirePermissions(PERMISSIONS.APPROVE_DISPOSAL_SALE_REQUEST)
    async approve(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.disposalSalesService.approve(id, user.sub);
        return {
            message:
                'تمت الموافقة على طلب البيع. بانتظار إضافة الصور والتأكيد.',
            data,
        };
    }

    @Post(':id/reject')
    @RequirePermissions(PERMISSIONS.APPROVE_DISPOSAL_SALE_REQUEST)
    async reject(@Param('id') id: string, @Body() dto: RejectRequestDto) {
        const data = await this.disposalSalesService.reject(id, dto);
        return { message: 'تم رفض طلب البيع.', data };
    }

    @Post(':id/cancel')
    @RequirePermissions(PERMISSIONS.CREATE_DISPOSAL_SALE_REQUEST)
    async cancel(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.disposalSalesService.cancel(id, user.sub);
        return { message: 'تم إلغاء طلب البيع.', data };
    }

    @Post(':id/images')
    @RequirePermissions(PERMISSIONS.CREATE_DISPOSAL_SALE_REQUEST)
    @UseInterceptors(
        FilesInterceptor('images', DISPOSAL_SALE_IMAGE_UPLOAD_HARD_CEILING, {
            storage: multer.memoryStorage(),
            limits: { fileSize: 5 * 1024 * 1024 },
        }),
    )
    async addImages(
        @Param('id') id: string,
        @UploadedFiles(
            new ParseFilePipeBuilder()
                .addFileTypeValidator({
                    fileType: /^image\/(jpeg|jpg|png|webp)$/,
                })
                .build({
                    errorHttpStatusCode: HttpStatus.BAD_REQUEST,
                    fileIsRequired: true,
                }),
        )
        images: Express.Multer.File[],
    ) {
        const data = await this.disposalSalesService.addImages(id, images);
        return { message: 'تمت إضافة الصور.', data };
    }

    @Post(':id/confirm')
    @RequirePermissions(PERMISSIONS.CREATE_DISPOSAL_SALE_REQUEST)
    async confirm(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.disposalSalesService.confirm(id, user.sub);
        return {
            message: 'تم تأكيد طلب البيع وتحديث مخزون مستودع الهالك.',
            data,
        };
    }
    @Get(':id/images')
    @RequirePermissions(PERMISSIONS.VIEW_DISPOSAL)
    async getImages(@Param('id') id: string) {
        const data = await this.disposalSalesService.getImageUrls(id);
        return { message: 'Success', data };
    }
}
