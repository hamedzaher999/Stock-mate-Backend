export const NOTIFICATION_TYPES = {
    STOCK_BELOW_MINIMUM: 'stock_below_minimum',
    STOCK_ABOVE_MAXIMUM: 'stock_above_maximum',
    QUEUE_WAIT_EXCEEDED: 'queue_wait_exceeded',
    PERIODIC_REFILL_GENERATED: 'periodic_refill_generated',
    PERIODIC_REFILL_PENDING_APPROVAL: 'periodic_refill_pending_approval',
    REFILL_REQUEST_STATUS_CHANGED: 'refill_request_status_changed',
    PURCHASE_REQUEST_STATUS_CHANGED: 'purchase_request_status_changed',
    AI_INSIGHT: 'ai_insight',
} as const;

export type NotificationTypeCode =
    (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];
