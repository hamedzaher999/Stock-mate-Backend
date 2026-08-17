import {
    Body,
    Controller,
    Get,
    HttpStatus,
    Param,
    ParseFilePipeBuilder,
    Patch,
    Post,
    Query,
    UploadedFiles,
    UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { PurchaseReceivingService } from './purchase-receiving.service';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { ConfirmPurchaseReceiptDto } from './dto/confirm-purchase-receipt.dto';
import { ListPurchaseReceiptsDto } from './dto/list-purchase-receipts.dto';
import { CreatePurchaseReceiptFormDto } from './dto/create-purchase-receipt-form.dto';
import { UpdatePurchaseReceiptFormDto } from './dto/update-purchase-receipt-form.dto';
const PURCHASE_RECEIPT_UPLOAD_HARD_CEILING = 30;
@Controller('purchasing/receipts')
export class PurchaseReceivingController {
    constructor(
        private readonly purchaseReceivingService: PurchaseReceivingService,
    ) {}

    @Get()
    @RequirePermissions(PERMISSIONS.VIEW_PURCHASING_HISTORY)
    async findAll(@Query() query: ListPurchaseReceiptsDto) {
        const data = await this.purchaseReceivingService.list(query);
        return { message: 'Success', data };
    }

    @Get(':id')
    @RequirePermissions(PERMISSIONS.VIEW_PURCHASING_HISTORY)
    async findOne(@Param('id') id: string) {
        const data = await this.purchaseReceivingService.findById(id);
        return { message: 'Success', data };
    }

    @Get(':id/images')
    @RequirePermissions(PERMISSIONS.VIEW_PURCHASING_HISTORY)
    async getImages(@Param('id') id: string) {
        const data = await this.purchaseReceivingService.getImageUrls(id);
        return { message: 'Success', data };
    }

    @Post()
    @RequirePermissions(PERMISSIONS.RECEIVE_PURCHASE)
    @UseInterceptors(
        FilesInterceptor(
            'receiptImages',
            PURCHASE_RECEIPT_UPLOAD_HARD_CEILING,
            {
                storage: multer.memoryStorage(),
                limits: { fileSize: 5 * 1024 * 1024 },
            },
        ),
    )
    async create(
        @Body() rawBody: CreatePurchaseReceiptFormDto,
        @UploadedFiles(
            new ParseFilePipeBuilder()
                .addFileTypeValidator({
                    fileType: /^image\/(jpeg|jpg|png|webp)$/,
                })
                .build({
                    errorHttpStatusCode: HttpStatus.BAD_REQUEST,
                    fileIsRequired: true,
                    exceptionFactory: () =>
                        new Error(
                            'At least one receipt image is required, and each file must be a valid image.',
                        ),
                }),
        )
        receiptImages: Express.Multer.File[],
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const dto = await this.purchaseReceivingService.parseCreateDto(rawBody);
        const data = await this.purchaseReceivingService.create(
            dto,
            user.sub,
            receiptImages,
        );
        return {
            message:
                'تم تسجيل إيصال الشراء. في انتظار التأكيد من مدير المستودع الذي طلبه.',
            data,
        };
    }

    @Post(':id/confirm')
    @RequirePermissions(PERMISSIONS.CONFIRM_PURCHASE_RECEIPT)
    async confirm(
        @Param('id') id: string,
        @Body() dto: ConfirmPurchaseReceiptDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const data = await this.purchaseReceivingService.confirm(
            id,
            dto,
            user.sub,
        );
        return {
            message: 'تم تأكيد إيصال الشراء وتحديث مخزون المستودع.',
            data,
        };
    }

    @Patch(':id')
    @RequirePermissions(PERMISSIONS.RECEIVE_PURCHASE)
    @UseInterceptors(
        FilesInterceptor('newImages', PURCHASE_RECEIPT_UPLOAD_HARD_CEILING, {
            storage: multer.memoryStorage(),
            limits: { fileSize: 5 * 1024 * 1024 },
        }),
    )
    async update(
        @Param('id') id: string,
        @Body() rawBody: UpdatePurchaseReceiptFormDto,
        @UploadedFiles(
            new ParseFilePipeBuilder()
                .addFileTypeValidator({
                    fileType: /^image\/(jpeg|jpg|png|webp)$/,
                })
                .build({
                    errorHttpStatusCode: HttpStatus.BAD_REQUEST,
                    fileIsRequired: false,
                }),
        )
        newImages: Express.Multer.File[] = [],
    ) {
        const dto = await this.purchaseReceivingService.parseUpdateDto(rawBody);
        const data = await this.purchaseReceivingService.update(
            id,
            dto,
            newImages,
        );
        return { message: 'تم تحديث إيصال الشراء.', data };
    }

    @Post(':id/cancel')
    @RequirePermissions(PERMISSIONS.RECEIVE_PURCHASE)
    async cancel(@Param('id') id: string) {
        const data = await this.purchaseReceivingService.cancel(id);
        return { message: 'تم إلغاء إيصال الشراء.', data };
    }
}
