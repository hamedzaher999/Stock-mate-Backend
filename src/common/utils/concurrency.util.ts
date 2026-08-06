export class AlreadyProcessedError extends Error {
    constructor(
        message = 'This record was already processed by another request.',
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
            `Dispensed quantity exceeds what remains for this cycle (remaining: ${remaining}).`,
        );
    }
}
