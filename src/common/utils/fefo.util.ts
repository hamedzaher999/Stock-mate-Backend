export interface FefoBatchStock {
    batchId: string;
    expirationDate: Date | null;
    quantity: number;
}

export interface FefoAllocation {
    batchId: string;
    quantity: number;
}

export class InsufficientStockError extends Error {
    constructor(public readonly shortfall: number) {
        super(`Insufficient stock: short by ${shortfall}.`);
    }
}

export function allocateFefo(
    batches: FefoBatchStock[],
    requestedQuantity: number,
): FefoAllocation[] {
    const sorted = [...batches].sort((a, b) => {
        if (!a.expirationDate && !b.expirationDate) return 0;
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        return a.expirationDate.getTime() - b.expirationDate.getTime();
    });

    const allocations: FefoAllocation[] = [];
    let remaining = requestedQuantity;

    for (const batch of sorted) {
        if (remaining <= 0) break;
        if (batch.quantity <= 0) continue;
        const take = Math.min(batch.quantity, remaining);
        allocations.push({ batchId: batch.batchId, quantity: take });
        remaining -= take;
    }

    if (remaining > 0) {
        throw new InsufficientStockError(remaining);
    }

    return allocations;
}
