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
            throw new BadRequestException('لم يتم تكوين قسم مستودع الهالك.');
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
        if (!request) throw new NotFoundException('طلب بيع الهالك غير موجود.');
        return request;
    }

    async create(dto: CreateDisposalSaleRequestDto, requestedById: string) {
        const destination =
            await this.disposalSalesRepository.destinationExists(
                dto.destinationId,
            );
        if (!destination)
            throw new BadRequestException('جهة الوجهة غير موجودة.');
        if (!destination.isActive)
            throw new BadRequestException(
                'لا يمكن إنشاء طلب ضد جهة وجهة غير نشطة.',
            );

        const warehouse =
            await this.departmentsCacheService.getByType('disposal_warehouse');
        if (!warehouse) {
            throw new BadRequestException('لم يتم تكوين قسم مستودع الهالك.');
        }

        for (const item of dto.items) {
            const batch =
                await this.disposalSalesRepository.findBatchForValidation(
                    item.batchId,
                );
            if (!batch)
                throw new BadRequestException('الدفعة (Batch) غير موجودة.');
            if (batch.variantId !== item.variantId) {
                throw new BadRequestException(
                    'الدفعة المختارة لا تتطابق مع المتغير المحدد.',
                );
            }

            const stock = await this.disposalSalesRepository.findBatchStock(
                item.batchId,
                warehouse.id,
            );
            if (!stock || Number(stock.quantity) < item.quantity) {
                throw new BadRequestException(
                    'المخزون غير كافٍ في واحدة أو أكثر من الدفعات المختارة في مستودع الهالك.',
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
            throw new ConflictException('هذا الطلب ليس في انتظار الموافقة.');
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
            throw new ConflictException('هذا الطلب ليس في انتظار الموافقة.');
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
                'يمكن فقط إلغاء الطلب الذي ينتظر الموافقة.',
            );
        }
        if (request.requestedById !== requestingUserId) {
            throw new ForbiddenException(
                'يمكنك فقط إلغاء طلبات بيع الهالك التي قمت بإنشائها.',
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
                'لا يمكن إضافة الصور إلا أثناء انتظار الطلب للتأكيد.',
            );
        }

        for (const file of files) {
            if (!detectImageMimeType(file.buffer)) {
                throw new BadRequestException(
                    'واحد أو أكثر من الملفات المرفوعة ليس صورة صالحة بتنسيق JPEG أو PNG أو WEBP.',
                );
            }
        }

        const maxImages =
            this.configService.get<number>('DISPOSAL_SALE_MAX_IMAGES') ?? 10;
        if (request.images.length + files.length > maxImages) {
            throw new BadRequestException(
                `يمكن أن يحتوي طلب بيع الهالك على ${maxImages} صور كحد أقصى.`,
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
            throw new ConflictException('هذا الطلب ليس في انتظار التأكيد.');
        }
        if (request.images.length === 0) {
            throw new BadRequestException(
                'مطلوب صورة واحدة على الأقل قبل إمكانية تأكيد هذا الطلب.',
            );
        }

        const warehouse =
            await this.departmentsCacheService.getByType('disposal_warehouse');
        if (!warehouse) {
            throw new BadRequestException('لم يتم تكوين قسم مستودع الهالك.');
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
                    'لقد تغير المخزون في مستودع الهالك منذ إنشاء هذا الطلب ولم يعد كافياً لعنصر واحد أو أكثر.',
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
            title: 'تم تحديث حالة طلب بيع الهالك',
            body: `طلب بيع الهالك الخاص بك أصبح الآن "${request.status}".`,
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
