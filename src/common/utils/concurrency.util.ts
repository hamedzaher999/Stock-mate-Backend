export class AlreadyProcessedError extends Error {
    constructor(
        message = 'تم معالجة هذا الطلب بالفعل. يرجى تحديث الصفحة والمحاولة مرة أخرى.',
    ) {
        super(message);
    }
}

export class CycleAllowanceExceededError extends Error {
    constructor(
        public readonly prescriptionItemId: string,
        public readonly remaining: number,
    ) {
        super(
            `الكمية المطلوبة تتجاوز المتاح في هذه الدورة (المتبقي: ${remaining}).`,
        );
    }
}
