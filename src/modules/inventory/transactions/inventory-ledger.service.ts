import { Injectable } from '@nestjs/common';
import { Prisma, TransactionType, ReferenceType } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class InventoryLedgerService {
  record(
    tx: TxClient,
    params: {
      transactionType: TransactionType;
      variantId: string;
      batchId: string;
      departmentId: string;
      quantity: number;
      balanceAfter: number;
      referenceType?: ReferenceType;
      referenceId?: string;
      performedById: string;
      notes?: string;
    },
  ) {
    return tx.inventoryTransaction.create({
      data: {
        transactionType: params.transactionType,
        variantId: params.variantId,
        batchId: params.batchId,
        departmentId: params.departmentId,
        quantity: params.quantity,
        balanceAfter: params.balanceAfter,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        performedById: params.performedById,
        notes: params.notes,
      },
    });
  }
}
