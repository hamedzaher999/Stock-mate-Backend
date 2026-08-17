import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { DisposalSalesRepository } from './disposal-sales.repository';
import { DepartmentsCacheService } from '../departments/departments-cache.service';
import { DepartmentInventoryService } from '../inventory/department-inventory/department-inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import { ListDisposalSaleRequestsDto } from './dto/list-disposal-sale-requests.dto';
import { PaginatedResult } from '../../core/interfaces/paginated-result.interface';
import { CreateDisposalSaleRequestDto } from './dto/create-disposal-sale-request.dto';
import { NOTIFICATION_TYPES } from '../../common/constants/notification-types.constants';
import { RejectRequestDto } from '../../common/dto/reject-request.dto';
import { detectImageMimeType } from '../../common/utils/image-signature.util';
import { InsufficientStockError } from '../../common/utils/fefo.util';
import { AlreadyProcessedError } from '../../common/utils/concurrency.util';
import { STORAGE_SERVICE } from '../../core/storage/storage.interface';
import type {
    IStorageService,
    UploadedImage,
} from '../../core/storage/storage.interface';

@Injectable()
export class DisposalSalesService {
    constructor(
        private readonly disposalSalesRepository: DisposalSalesRepository,
        private readonly departmentsCacheService: DepartmentsCacheService,
        private readonly departmentInventoryService: DepartmentInventoryService,
        private readonly notificationsService: NotificationsService,
        private readonly configService: ConfigService,
        @Inject(STORAGE_SERVICE)
        private readonly storageService: IStorageService,
    ) {}
    async getWarehouseLiveStock(
        requestingUserId: string,
        page = 1,
        limit = 20,
    ) {
        const warehouse =
            await this.departmentsCacheService.getByType('disposal_warehouse');
        if (!warehouse) {
            throw new BadRequestException(
                'No Disposal Warehouse department is configured.',
            );
        }
        return this.departmentInventoryService.getLiveStock(
            warehouse.id,
            requestingUserId,
            page,
            limit,
        );
    }

    async list(
        dto: ListDisposalSaleRequestsDto,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const { items, total } = await this.disposalSalesRepository.findMany({
            skip: (page - 1) * limit,
            take: limit,
            destinationId: dto.destinationId,
            status: dto.status,
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
        const request = await this.disposalSalesRepository.findById(id);
        if (!request)
            throw new NotFoundException('Disposal sale request not found.');
        return request;
    }

    async create(dto: CreateDisposalSaleRequestDto, requestedById: string) {
        const destination =
            await this.disposalSalesRepository.destinationExists(
                dto.destinationId,
            );
        if (!destination)
            throw new BadRequestException('Destination does not exist.');
        if (!destination.isActive)
            throw new BadRequestException(
                'Cannot create a request against an inactive destination.',
            );

        const warehouse =
            await this.departmentsCacheService.getByType('disposal_warehouse');
        if (!warehouse) {
            throw new BadRequestException(
                'No Disposal Warehouse department is configured.',
            );
        }

        for (const item of dto.items) {
            const batch =
                await this.disposalSalesRepository.findBatchForValidation(
                    item.batchId,
                );
            if (!batch) throw new BadRequestException('Batch does not exist.');
            if (batch.variantId !== item.variantId) {
                throw new BadRequestException(
                    'Selected batch does not match the given variant.',
                );
            }

            const stock = await this.disposalSalesRepository.findBatchStock(
                item.batchId,
                warehouse.id,
            );
            if (!stock || Number(stock.quantity) < item.quantity) {
                throw new BadRequestException(
                    'Insufficient stock in one or more selected batches at the Disposal Warehouse.',
                );
            }
        }

        const created = await this.disposalSalesRepository.create({
            destinationId: dto.destinationId,
            requestedById,
            notes: dto.notes,
            items: dto.items,
        });

        const hospitalManager =
            await this.disposalSalesRepository.findHospitalManagerId();
        if (hospitalManager) {
            await this.notificationsService.create({
                userId: hospitalManager.id,
                type: NOTIFICATION_TYPES.DISPOSAL_SALE_REQUEST_STATUS_CHANGED,
                category: 'inventory',
                title: 'طلب بيع هالك جديد بانتظار الموافقة',
                body: 'تم إنشاء طلب بيع هالك جديد وهو بانتظار موافقتك.',
                data: { disposalSaleRequestId: created.id },
            });
        }

        return created;
    }

    async approve(id: string, approverId: string) {
        const request = await this.findById(id);
        if (request.status !== 'pending_approval') {
            throw new ConflictException(
                'This request is not awaiting approval.',
            );
        }

        const updated = await this.runGuarded(() =>
            this.disposalSalesRepository.updateStatus(id, 'pending_approval', {
                status: 'awaiting_confirmation',
                approvedById: approverId,
                approvedAt: new Date(),
            }),
        );
        await this.notifyStatusChange(updated);
        return updated;
    }

    async reject(id: string, dto: RejectRequestDto) {
        const request = await this.findById(id);
        if (request.status !== 'pending_approval') {
            throw new ConflictException(
                'This request is not awaiting approval.',
            );
        }

        const updated = await this.runGuarded(() =>
            this.disposalSalesRepository.updateStatus(id, 'pending_approval', {
                status: 'rejected',
                rejectionReason: dto.reason,
            }),
        );
        await this.notifyStatusChange(updated);
        return updated;
    }

    async cancel(id: string, requestingUserId: string) {
        const request = await this.findById(id);
        if (request.status !== 'pending_approval') {
            throw new ConflictException(
                'Only a request awaiting approval can be cancelled.',
            );
        }
        if (request.requestedById !== requestingUserId) {
            throw new ForbiddenException(
                'You can only cancel disposal sale requests you created.',
            );
        }

        const updated = await this.runGuarded(() =>
            this.disposalSalesRepository.updateStatus(id, 'pending_approval', {
                status: 'cancelled',
            }),
        );
        await this.notifyStatusChange(updated);
        return updated;
    }

    async addImages(id: string, files: Express.Multer.File[]) {
        const request = await this.findById(id);
        if (request.status !== 'awaiting_confirmation') {
            throw new ConflictException(
                'Images can only be added while the request is awaiting confirmation.',
            );
        }

        for (const file of files) {
            if (!detectImageMimeType(file.buffer)) {
                throw new BadRequestException(
                    'One or more uploaded files are not a valid JPEG, PNG, or WEBP image.',
                );
            }
        }

        const maxImages =
            this.configService.get<number>('DISPOSAL_SALE_MAX_IMAGES') ?? 10;
        if (request.images.length + files.length > maxImages) {
            throw new BadRequestException(
                `A disposal sale request can have at most ${maxImages} images.`,
            );
        }

        const uploaded: UploadedImage[] = [];
        try {
            for (const file of files) {
                const image = await this.storageService.uploadImage(
                    file.buffer,
                    {
                        folder: `disposal-sales/${id}`,
                        contentType: file.mimetype,
                    },
                );
                uploaded.push(image);
            }
        } catch (error) {
            await Promise.all(
                uploaded.map((img) => this.storageService.deleteImage(img.key)),
            );
            throw error;
        }

        const nextSortOrderStart =
            request.images.length > 0
                ? Math.max(...request.images.map((i) => i.sortOrder)) + 1
                : 0;

        return this.disposalSalesRepository.addImages(
            id,
            uploaded.map((u) => u.key),
            nextSortOrderStart,
        );
    }

    async confirm(id: string, confirmingUserId: string) {
        const request = await this.findById(id);
        if (request.status !== 'awaiting_confirmation') {
            throw new ConflictException(
                'This request is not awaiting confirmation.',
            );
        }
        if (request.images.length === 0) {
            throw new BadRequestException(
                'At least one image is required before this request can be confirmed.',
            );
        }

        const warehouse =
            await this.departmentsCacheService.getByType('disposal_warehouse');
        if (!warehouse) {
            throw new BadRequestException(
                'No Disposal Warehouse department is configured.',
            );
        }

        let result: Awaited<
            ReturnType<typeof this.disposalSalesRepository.confirmComplete>
        >;
        try {
            result = await this.disposalSalesRepository.confirmComplete({
                requestId: id,
                warehouseDepartmentId: warehouse.id,
                confirmedById: confirmingUserId,
                items: request.items.map((i) => ({
                    batchId: i.batchId,
                    variantId: i.variantId,
                    quantity: Number(i.quantity),
                })),
            });
        } catch (error) {
            if (error instanceof AlreadyProcessedError) {
                throw new ConflictException(error.message);
            }
            if (error instanceof InsufficientStockError) {
                throw new BadRequestException(
                    'Stock at the Disposal Warehouse has changed since this request was created and is no longer sufficient for one or more items.',
                );
            }
            throw error;
        }

        await this.notifyStatusChange(result);
        return result;
    }

    private notifyStatusChange(request: {
        id: string;
        requestedById: string;
        status: string;
    }) {
        return this.notificationsService.create({
            userId: request.requestedById,
            type: NOTIFICATION_TYPES.DISPOSAL_SALE_REQUEST_STATUS_CHANGED,
            category: 'inventory',
            title: 'Disposal sale request status updated',
            body: `Your disposal sale request is now "${request.status}".`,
            data: { disposalSaleRequestId: request.id, status: request.status },
        });
    }

    private async runGuarded<T>(action: () => Promise<T>): Promise<T> {
        try {
            return await action();
        } catch (error) {
            if (error instanceof AlreadyProcessedError) {
                throw new ConflictException(error.message);
            }
            throw error;
        }
    }

    async getImageUrls(id: string) {
        await this.findById(id);
        const images = await this.disposalSalesRepository.findImageKeys(id);

        return Promise.all(
            images.map(async (image) => {
                const signed = await this.storageService.getSignedUrl(
                    image.imageKey,
                );
                return {
                    id: image.id,
                    sortOrder: image.sortOrder,
                    url: signed.url,
                    expiresAt: signed.expiresAt,
                };
            }),
        );
    }
}
