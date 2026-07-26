import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PeriodicSchedulesRepository } from './periodic-schedules.repository';
import { ListPeriodicSchedulesDto } from './dto/list-periodic-schedules.dto';
import { CancelPeriodicScheduleDto } from './dto/cancel-periodic-schedule.dto';
import { PaginatedResult } from '../../../core/interfaces/paginated-result.interface';
import { UserScopeService } from '../../rbac/user-scope.service';
import { AlreadyProcessedError } from '../../../common/utils/concurrency.util';

@Injectable()
export class PeriodicSchedulesService {
    constructor(
        private readonly periodicSchedulesRepository: PeriodicSchedulesRepository,
        private readonly userScopeService: UserScopeService,
    ) {}

    async list(
        dto: ListPeriodicSchedulesDto,
        requestingUserId: string,
    ): Promise<PaginatedResult<unknown>> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && dto.departmentId && dto.departmentId !== scope) {
            throw new ForbiddenException(
                'You can only view schedules for your own department.',
            );
        }

        const { items, total } =
            await this.periodicSchedulesRepository.findMany({
                skip: (page - 1) * limit,
                take: limit,
                departmentId: dto.departmentId ?? scope ?? undefined,
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

    async findById(id: string, requestingUserId: string) {
        const schedule = await this.periodicSchedulesRepository.findById(id);
        if (!schedule)
            throw new NotFoundException('Periodic refill schedule not found.');

        const scope = await this.resolveDepartmentScope(requestingUserId);
        if (scope && schedule.departmentId !== scope) {
            throw new ForbiddenException(
                'You can only view schedules for your own department.',
            );
        }

        return schedule;
    }

    async cancel(
        id: string,
        dto: CancelPeriodicScheduleDto,
        requestingUserId: string,
    ) {
        const schedule = await this.findById(id, requestingUserId);
        if (schedule.status !== 'active') {
            throw new ConflictException(
                'Only an active schedule can be cancelled.',
            );
        }

        try {
            return await this.periodicSchedulesRepository.cancel({
                id,
                reason: dto.reason,
                cancelledById: requestingUserId,
            });
        } catch (error) {
            if (error instanceof AlreadyProcessedError) {
                throw new ConflictException(
                    'This schedule was already cancelled by another request.',
                );
            }
            throw error;
        }
    }
    private async resolveDepartmentScope(
        requestingUserId: string,
    ): Promise<string | null> {
        const scope =
            await this.userScopeService.getUserScope(requestingUserId);
        if (!scope) throw new BadRequestException('Requesting user not found.');
        if (scope.isSuperAdmin) return null;
        return scope.departmentId;
    }
}
