import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PurchaseReceivingRepository } from './purchase-receiving.repository';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { DepartmentsCacheService } from '../../departments/departments-cache.service';
import {
    type IStorageService,
    STORAGE_SERVICE,
} from '../../../core/storage/storage.interface';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { NOTIFICATION_TYPES } from '../../../common/constants/notification-types.constants';
import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto';
import { UpdatePurchaseReceiptDto } from './dto/update-purchase-receipt.dto';
import { ConfirmPurchaseReceiptDto } from './dto/confirm-purchase-receipt.dto';
import { ListPurchaseReceiptsDto } from './dto/list-purchase-receipts.dto';
import { AlreadyProcessedError } from '../../../common/utils/concurrency.util';
import { CreatePurchaseReceiptFormDto } from './dto/create-purchase-receipt-form.dto';
import { detectImageMimeType } from '../../../common/utils/image-signature.util';

const RECEIVABLE_REQUEST_STATUSES = ['preparing', 'partially_complete'];

@Injectable()
export class PurchaseReceivingService {
    constructor(
        private readonly purchaseReceivingRepository: PurchaseReceivingRepository,
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
        private readonly departmentsCacheService: DepartmentsCacheService,
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
            purchaseRequestId: raw.purchaseRequestId,
            supplierId: raw.supplierId,
            receivingDate: raw.receivingDate,
            type: raw.type,
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
        const detectedMimeType = detectImageMimeType(receiptImage.buffer);
        if (!detectedMimeType) {
            throw new BadRequestException(
                'The uploaded file is not a valid JPEG, PNG, or WEBP image.',
            );
        }
        const request =
            await this.purchaseReceivingRepository.findRequestForReceiving(
                dto.purchaseRequestId,
            );
        if (!request)
            throw new BadRequestException('Purchase request does not exist.');
        if (!RECEIVABLE_REQUEST_STATUSES.includes(request.status)) {
            throw new ConflictException(
                'This purchase request is not open for receiving.',
            );
        }

        const supplier = await this.purchaseReceivingRepository.supplierExists(
            dto.supplierId,
        );
        if (!supplier)
            throw new BadRequestException('Supplier does not exist.');
        if (!supplier.isActive)
            throw new BadRequestException(
                'Cannot record a receipt against an inactive supplier.',
            );

        const purchaseRequestItemIds = dto.items.map(
            (i) => i.purchaseRequestItemId,
        );
        if (
            new Set(purchaseRequestItemIds).size !==
            purchaseRequestItemIds.length
        ) {
            throw new BadRequestException(
                'Each purchase request item can only appear once on a receipt.',
            );
        }

        const lines = dto.items.map((inputItem) => {
            const requestItem = request.items.find(
                (i) => i.id === inputItem.purchaseRequestItemId,
            );
            if (!requestItem)
                throw new BadRequestException(
                    'One or more items do not belong to this purchase request.',
                );
            if (requestItem.approvedQuantity === null) {
                throw new BadRequestException(
                    'This item has not been assigned an approved quantity yet.',
                );
            }

            const expectedQuantity =
                Number(requestItem.approvedQuantity) -
                Number(requestItem.receivedQuantity);

            return {
                purchaseRequestItemId: requestItem.id,
                variantId: requestItem.variantId,
                expectedQuantity,
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
                folder: `purchase-receipts/${dto.purchaseRequestId}`,
                contentType: detectedMimeType,
            },
        );

        try {
            return await this.purchaseReceivingRepository.recordReceipt({
                purchaseRequestId: dto.purchaseRequestId,
                supplierId: dto.supplierId,
                receivedById,
                receivingDate: new Date(dto.receivingDate),
                type: dto.type ?? 'batch',
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
        confirmingUserId: string,
    ) {
        const receipt = await this.findById(id);
        if (receipt.status !== 'pending_confirmation') {
            throw new ConflictException(
                'This receipt has already been confirmed.',
            );
        }

        const request = await this.prisma.purchaseRequest.findUnique({
            where: { id: receipt.purchaseRequestId },
            select: { id: true, requestedById: true },
        });
        if (!request)
            throw new NotFoundException(
                'Associated purchase request not found.',
            );

        if (request.requestedById !== confirmingUserId) {
            throw new ForbiddenException(
                'Only the user who created this purchase request can confirm receipts against it.',
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

        const warehouse =
            await this.departmentsCacheService.getByType('central_warehouse');
        if (!warehouse) {
            throw new BadRequestException(
                'No Central Warehouse department is configured.',
            );
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
                    'Confirmed quantity cannot exceed the declared received quantity for that batch.',
                );
            }

            return {
                receiptItemId: receiptItem.id,
                purchaseRequestItemId: receiptItem.purchaseRequestItemId,
                variantId: receiptItem.variantId,
                supplierId: receipt.supplierId,
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

        let result: Awaited<
            ReturnType<typeof this.purchaseReceivingRepository.confirmReceipt>
        >;
        try {
            result = await this.purchaseReceivingRepository.confirmReceipt({
                receiptId: id,
                purchaseRequestId: receipt.purchaseRequestId,
                warehouseDepartmentId: warehouse.id,
                receivingDate: receipt.receivingDate,
                confirmedById: confirmingUserId,
                notes: dto.notes,
                batchType: receipt.type,
                confirmations,
            });
        } catch (error) {
            if (error instanceof AlreadyProcessedError) {
                throw new ConflictException(
                    'This receipt has already been confirmed.',
                );
            }
            throw error;
        }

        const updatedRequest =
            await this.prisma.purchaseRequest.findUniqueOrThrow({
                where: { id: receipt.purchaseRequestId },
                select: {
                    id: true,
                    requestNumber: true,
                    requestedById: true,
                    status: true,
                },
            });
        await this.notificationsService.create({
            userId: updatedRequest.requestedById,
            type: NOTIFICATION_TYPES.PURCHASE_REQUEST_STATUS_CHANGED,
            category: 'purchasing',
            title: 'Purchase request status updated',
            body: `Purchase request ${updatedRequest.requestNumber} is now "${updatedRequest.status}".`,
            data: {
                purchaseRequestId: updatedRequest.id,
                status: updatedRequest.status,
            },
        });

        return result;
    }

    async update(id: string, dto: UpdatePurchaseReceiptDto) {
        const receipt = await this.findById(id);
        if (receipt.status !== 'pending_confirmation') {
            throw new ConflictException(
                'Only a receipt awaiting confirmation can be edited.',
            );
        }

        const request =
            await this.purchaseReceivingRepository.findRequestForReceiving(
                receipt.purchaseRequestId,
            );
        if (!request) {
            throw new BadRequestException(
                'Associated purchase request not found.',
            );
        }

        let lines:
            | {
                  purchaseRequestItemId: string;
                  variantId: string;
                  expectedQuantity: number | null;
                  quantity: number;
                  batchNumber: string;
                  manufacturingDate?: Date;
                  expirationDate?: Date;
                  purchasePrice?: number;
              }[]
            | undefined;

        if (dto.items) {
            const purchaseRequestItemIds = dto.items.map(
                (i) => i.purchaseRequestItemId,
            );
            if (
                new Set(purchaseRequestItemIds).size !==
                purchaseRequestItemIds.length
            ) {
                throw new BadRequestException(
                    'Each purchase request item can only appear once on a receipt.',
                );
            }

            lines = dto.items.map((inputItem) => {
                const requestItem = request.items.find(
                    (i) => i.id === inputItem.purchaseRequestItemId,
                );
                if (!requestItem) {
                    throw new BadRequestException(
                        'One or more items do not belong to this purchase request.',
                    );
                }

                const expectedQuantity =
                    requestItem.approvedQuantity !== null
                        ? Number(requestItem.approvedQuantity) -
                          Number(requestItem.receivedQuantity)
                        : null;

                return {
                    purchaseRequestItemId: requestItem.id,
                    variantId: requestItem.variantId,
                    expectedQuantity,
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
        }

        return this.purchaseReceivingRepository.replaceItems(id, {
            receivingDate: dto.receivingDate
                ? new Date(dto.receivingDate)
                : undefined,
            notes: dto.notes,
            items: lines,
        });
    }

    async cancel(id: string) {
        const receipt = await this.findById(id);
        if (receipt.status !== 'pending_confirmation') {
            throw new ConflictException(
                'Only a receipt awaiting confirmation can be cancelled.',
            );
        }

        const imageRecord =
            await this.purchaseReceivingRepository.findImageKey(id);
        if (imageRecord) {
            await this.storageService.deleteImage(imageRecord.receiptImageKey);
        }

        return this.purchaseReceivingRepository.cancel(id);
    }
}
