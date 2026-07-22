import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PurchaseReceivingRepository } from './purchase-receiving.repository';
import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto';
import { ListPurchaseReceiptsDto } from './dto/list-purchase-receipts.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { NotificationsService } from '../../notifications/notifications.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { NOTIFICATION_TYPES } from '../../../common/constants/notification-types.constants';
import { ConfirmPurchaseReceiptDto } from './dto/confirm-purchase-receipt.dto';
import { Inject } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePurchaseReceiptFormDto } from './dto/create-purchase-receipt-form.dto';
import {
    STORAGE_SERVICE,
    type IStorageService,
} from '../../../core/storage/storage.interface';
const RECEIVABLE_ORDER_STATUSES = ['sent', 'partially_received'];

@Injectable()
export class PurchaseReceivingService {
    constructor(
        private readonly purchaseReceivingRepository: PurchaseReceivingRepository,
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
        @Inject(STORAGE_SERVICE)
        private readonly storageService: IStorageService,
    ) {}

    async list(
        dto: ListPurchaseReceiptsDto,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } =
            await this.purchaseReceivingRepository.findMany({
                skip: (page - 1) * limit,
                take: limit,
                purchaseOrderId: dto.purchaseOrderId,
                purchaseRequestId: dto.purchaseRequestId,
            });

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findById(id: string) {
        const receipt = await this.purchaseReceivingRepository.findById(id);
        if (!receipt)
            throw new NotFoundException('Purchase receipt not found.');
        return receipt;
    }

    async getImageUrl(id: string) {
        const receipt = await this.purchaseReceivingRepository.findImageKey(id);
        if (!receipt)
            throw new NotFoundException('Purchase receipt not found.');

        return this.storageService.getSignedUrl(receipt.receiptImageKey);
    }

    async parseCreateDto(
        raw: CreatePurchaseReceiptFormDto,
    ): Promise<CreatePurchaseReceiptDto> {
        let parsedItems: unknown;
        try {
            parsedItems = JSON.parse(raw.items);
        } catch {
            throw new BadRequestException(
                '"items" must be a valid JSON-encoded array.',
            );
        }

        if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
            throw new BadRequestException('"items" must be a non-empty array.');
        }

        const dto = plainToInstance(CreatePurchaseReceiptDto, {
            purchaseOrderId: raw.purchaseOrderId,
            receivingDate: raw.receivingDate,
            notes: raw.notes,
            items: parsedItems,
        });

        const errors = await validate(dto);
        if (errors.length > 0) {
            const messages = errors.flatMap((error) =>
                Object.values(error.constraints ?? {}),
            );
            throw new BadRequestException(
                messages.length > 0
                    ? messages
                    : 'Invalid purchase receipt payload.',
            );
        }

        return dto;
    }

    async create(
        dto: CreatePurchaseReceiptDto,
        receivedById: string,
        receiptImage: Express.Multer.File,
    ) {
        const order =
            await this.purchaseReceivingRepository.findOrderForReceiving(
                dto.purchaseOrderId,
            );
        if (!order)
            throw new BadRequestException('Purchase order does not exist.');
        if (!RECEIVABLE_ORDER_STATUSES.includes(order.status)) {
            throw new ConflictException(
                'This purchase order is not open for receiving.',
            );
        }

        const lines = dto.items.map((inputItem) => {
            const orderItem = order.items.find(
                (i) => i.id === inputItem.purchaseOrderItemId,
            );
            if (!orderItem)
                throw new BadRequestException(
                    'One or more items do not belong to this purchase order.',
                );

            const remaining =
                Number(orderItem.orderedQuantity) -
                Number(orderItem.receivedQuantity);
            if (inputItem.quantity > remaining) {
                throw new BadRequestException(
                    `Received quantity exceeds what remains on the order (remaining: ${remaining}).`,
                );
            }

            return {
                purchaseOrderItemId: orderItem.id,
                variantId: orderItem.variantId,
                expectedQuantity: remaining,
                quantity: inputItem.quantity,
                batchNumber: inputItem.batchNumber,
                manufacturingDate: inputItem.manufacturingDate
                    ? new Date(inputItem.manufacturingDate)
                    : undefined,
                expirationDate: inputItem.expirationDate
                    ? new Date(inputItem.expirationDate)
                    : undefined,
                purchasePrice: inputItem.purchasePrice,
            };
        });

        const uploaded = await this.storageService.uploadImage(
            receiptImage.buffer,
            {
                folder: `purchase-receipts/${order.purchaseRequestId}`,
                contentType: receiptImage.mimetype,
            },
        );

        try {
            return await this.purchaseReceivingRepository.recordReceipt({
                purchaseOrderId: order.id,
                purchaseRequestId: order.purchaseRequestId,
                supplierId: order.supplierId,
                receivedById,
                receivingDate: new Date(dto.receivingDate),
                notes: dto.notes,
                lines,
                receiptImageKey: uploaded.key,
            });
        } catch (error) {
            await this.storageService.deleteImage(uploaded.key);
            throw error;
        }
    }

    async confirm(
        id: string,
        dto: ConfirmPurchaseReceiptDto,
        confirmedById: string,
    ) {
        const receipt = await this.findById(id);
        if (receipt.status !== 'pending_confirmation') {
            throw new ConflictException(
                'This receipt has already been confirmed.',
            );
        }

        const itemIds = new Set(receipt.items.map((i) => i.id));
        const dtoItemIds = new Set(
            dto.items.map((i) => i.purchaseReceiptItemId),
        );
        if (
            itemIds.size !== dtoItemIds.size ||
            ![...itemIds].every((itemId) => dtoItemIds.has(itemId))
        ) {
            throw new BadRequestException(
                'Confirmed quantities must be provided for exactly every item on this receipt.',
            );
        }

        const order =
            await this.purchaseReceivingRepository.findOrderDestination(
                receipt.purchaseOrderId,
            );
        if (!order) {
            throw new NotFoundException('Associated purchase order not found.');
        }

        const confirmations = dto.items.map((confirmedItem) => {
            const receiptItem = receipt.items.find(
                (i) => i.id === confirmedItem.purchaseReceiptItemId,
            );
            if (!receiptItem)
                throw new BadRequestException(
                    'One or more items do not belong to this receipt.',
                );
            if (
                confirmedItem.confirmedQuantity > Number(receiptItem.quantity)
            ) {
                throw new BadRequestException(
                    'Confirmed quantity cannot exceed the declared received quantity.',
                );
            }

            return {
                receiptItemId: receiptItem.id,
                purchaseOrderItemId: receiptItem.purchaseOrderItemId,
                purchaseRequestItemId:
                    receiptItem.purchaseOrderItem.purchaseRequestItemId,
                variantId: receiptItem.variantId,
                supplierId: receiptItem.supplierId,
                declaredQuantity: Number(receiptItem.quantity),
                confirmedQuantity: confirmedItem.confirmedQuantity,
                batchNumber: receiptItem.batchNumber,
                manufacturingDate: receiptItem.manufacturingDate,
                expirationDate: receiptItem.expirationDate,
                purchasePrice: receiptItem.purchasePrice
                    ? Number(receiptItem.purchasePrice)
                    : null,
            };
        });

        const result = await this.purchaseReceivingRepository.confirmReceipt({
            receiptId: id,
            purchaseOrderId: receipt.purchaseOrderId,
            purchaseRequestId: receipt.purchaseRequestId,
            warehouseDepartmentId: order.destinationDepartmentId,
            receivingDate: receipt.receivingDate,
            confirmedById,
            notes: dto.notes,
            confirmations,
        });

        const updatedPr = await this.prisma.purchaseRequest.findUniqueOrThrow({
            where: { id: receipt.purchaseRequestId },
            select: {
                id: true,
                requestNumber: true,
                requestedById: true,
                status: true,
            },
        });
        await this.notificationsService.create({
            userId: updatedPr.requestedById,
            type: NOTIFICATION_TYPES.PURCHASE_REQUEST_STATUS_CHANGED,
            category: 'purchasing',
            title: 'Purchase request status updated',
            body: `Purchase request ${updatedPr.requestNumber} is now "${updatedPr.status}".`,
            data: { purchaseRequestId: updatedPr.id, status: updatedPr.status },
        });

        return result;
    }
}
