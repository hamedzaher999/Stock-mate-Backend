export class AlreadyProcessedError extends Error {
    constructor(
        message = 'This record was already processed by another request.',
    ) {
        super(message);
    }
}
