export type BatchType = 'batch' | 'final_batch';

export interface CompletionItemState {
    approvedQuantity: number | null;
    cumulativeConfirmed: number;
}

export type RequestCompletionOutcome = 'complete' | 'partially_complete';

export function resolveRequestCompletion(
    items: CompletionItemState[],
    confirmedBatchType: BatchType,
): RequestCompletionOutcome {
    const allItemsMet = items.every(
        (item) =>
            item.approvedQuantity !== null &&
            item.cumulativeConfirmed >= item.approvedQuantity,
    );

    if (allItemsMet) return 'complete';
    if (confirmedBatchType === 'final_batch') return 'complete';
    return 'partially_complete';
}
