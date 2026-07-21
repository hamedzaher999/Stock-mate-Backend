import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpStatus,
    Param,
    ParseFilePipeBuilder,
    Post,
    Query,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { PurchaseReceivingService } from './purchase-receiving.service';
import { ListPurchaseReceiptsDto } from './dto/list-purchase-receipts.dto';
import { CreatePurchaseReceiptFormDto } from './dto/create-purchase-receipt-form.dto';
import { ConfirmPurchaseReceiptDto } from './dto/confirm-purchase-receipt.dto';
import { RequirePermissions } from '../../../core/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constants';
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

    @Get(':id/image-url')
    @RequirePermissions(PERMISSIONS.VIEW_PURCHASING_HISTORY)
    async getImageUrl(@Param('id') id: string) {
        const data = await this.purchaseReceivingService.getImageUrl(id);
        return { message: 'Success', data };
    }

    @Post()
    @RequirePermissions(PERMISSIONS.RECEIVE_PURCHASE)
    @UseInterceptors(
        FileInterceptor('receiptImage', {
            storage: multer.memoryStorage(),
            limits: { fileSize: 5 * 1024 * 1024 },
        }),
    )
    async create(
        @Body() rawBody: CreatePurchaseReceiptFormDto,
        @UploadedFile(
            new ParseFilePipeBuilder()
                .addFileTypeValidator({
                    fileType: /^image\/(jpeg|jpg|png|webp)$/,
                })
                .build({
                    errorHttpStatusCode: HttpStatus.BAD_REQUEST,
                    fileIsRequired: true,
                    exceptionFactory: () =>
                        new BadRequestException(
                            'A receipt image is required to create a purchase receipt.',
                        ),
                }),
        )
        receiptImage: Express.Multer.File,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        const dto = await this.purchaseReceivingService.parseCreateDto(rawBody);
        const data = await this.purchaseReceivingService.create(
            dto,
            user.sub,
            receiptImage,
        );
        return {
            message:
                'Purchase receipt recorded. Awaiting warehouse confirmation.',
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
            message: 'Purchase receipt confirmed and warehouse stock updated.',
            data,
        };
    }
}
