export type FrequencyUnit = 'day' | 'week' | 'month';

export function computeCycleEnd(
    start: Date,
    unit?: FrequencyUnit | null,
    interval?: number | null,
): Date {
    if (!unit || !interval) return start;
    const end = new Date(start);
    if (unit === 'day') end.setDate(end.getDate() + interval);
    if (unit === 'week') end.setDate(end.getDate() + interval * 7);
    if (unit === 'month') end.setMonth(end.getMonth() + interval);
    return end;
}
