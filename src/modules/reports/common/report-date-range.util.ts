import { BadRequestException } from '@nestjs/common';
import { ReportGroupBy } from '../../../common/enums/report-group-by.enum';

export interface ResolvedDateRange {
    from: Date;
    to: Date;
}

export function resolveReportDateRange(
    fromStr: string,
    toStr: string,
): ResolvedDateRange {
    const from = new Date(fromStr);
    const to = endOfDayUtc(toStr);

    if (from.getTime() > to.getTime()) {
        throw new BadRequestException(
            '"from" date must be before or equal to "to" date.',
        );
    }

    return { from, to };
}

export function endOfDayUtc(dateStr: string): Date {
    const d = new Date(dateStr);
    return new Date(
        Date.UTC(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate(),
            23,
            59,
            59,
            999,
        ),
    );
}

export function pickDefaultGroupBy(
    from: Date,
    to: Date,
    explicit?: ReportGroupBy,
): ReportGroupBy {
    if (explicit) return explicit;
    const days = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    if (days <= 31) return ReportGroupBy.day;
    if (days <= 180) return ReportGroupBy.week;
    return ReportGroupBy.month;
}
