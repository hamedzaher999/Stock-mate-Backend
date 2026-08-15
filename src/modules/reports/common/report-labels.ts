export const TRANSACTION_TYPE_LABELS_AR: Record<string, string> = {
    purchase_receipt: 'استلام مشتريات',
    department_transfer_out: 'تحويل صادر إلى قسم',
    department_transfer_in: 'تحويل وارد من قسم',
    prescription_dispense: 'صرف وصفة طبية',
    department_consumption: 'استهلاك القسم',
    adjustment_damaged: 'تسوية - تالف',
    adjustment_expired: 'تسوية - منتهي الصلاحية',
    adjustment_shrinkage: 'تسوية - عجز',
    adjustment_found: 'تسوية - زيادة',
};

export const ADJUSTMENT_TYPE_LABELS_AR: Record<string, string> = {
    damaged: 'تالف',
    expired: 'منتهي الصلاحية',
    shrinkage: 'عجز',
    found: 'زيادة',
};

export const VISIT_STATUS_LABELS_AR: Record<string, string> = {
    completed: 'مكتملة',
    cancelled: 'ملغاة',
};

export const REFERENCE_TYPE_LABELS_AR: Record<string, string> = {
    purchase_receipt: 'إيصال شراء',
    refill_request: 'طلب تزويد',
    department_refill_delivery_item: 'صنف تسليم تزويد',
    prescription_dispense: 'صرف وصفة',
    adjustment: 'تسوية',
    stock_count: 'جرد مخزون',
};

export function translateEnum(
    map: Record<string, string>,
    value: string | null | undefined,
): string {
    if (!value) return '';
    return map[value] ?? value;
}
