export type FrequencyUnit = 'day' | 'week' | 'month';
export type RefillRequestType = 'normal' | 'daily' | 'weekly' | 'monthly';

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

export function requestTypeToFrequencyUnit(
    type: Exclude<RefillRequestType, 'normal'>,
): FrequencyUnit {
    const map: Record<Exclude<RefillRequestType, 'normal'>, FrequencyUnit> = {
        daily: 'day',
        weekly: 'week',
        monthly: 'month',
    };
    return map[type];
}
