-- CreateEnum
CREATE TYPE "disposal_item_source" AS ENUM ('adjustment', 'near_expiry');

-- CreateEnum
CREATE TYPE "disposal_transfer_status" AS ENUM ('initiated', 'confirmed', 'cancelled');

-- AlterEnum
ALTER TYPE "department_type" ADD VALUE 'disposal_warehouse';

-- AlterEnum
ALTER TYPE "reference_type" ADD VALUE 'disposal_transfer';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "transaction_type" ADD VALUE 'disposal_transfer_out';
ALTER TYPE "transaction_type" ADD VALUE 'disposal_transfer_in';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "near_expiry_disposal_days" INTEGER;

-- CreateTable
CREATE TABLE "disposal_transfers" (
    "id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "status" "disposal_transfer_status" NOT NULL DEFAULT 'initiated',
    "initiated_by" UUID NOT NULL,
    "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "notes" TEXT,

    CONSTRAINT "disposal_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disposal_transfer_items" (
    "id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "source_type" "disposal_item_source" NOT NULL,
    "adjustment_id" UUID,
    "variant_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "shipped_quantity" DECIMAL(65,30) NOT NULL,
    "confirmed_quantity" DECIMAL(65,30),
    "quantity_discrepancy" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "disposal_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "disposal_transfers_department_id_status_idx" ON "disposal_transfers"("department_id", "status");

-- CreateIndex
CREATE INDEX "disposal_transfer_items_adjustment_id_idx" ON "disposal_transfer_items"("adjustment_id");

-- AddForeignKey
ALTER TABLE "disposal_transfers" ADD CONSTRAINT "disposal_transfers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_transfers" ADD CONSTRAINT "disposal_transfers_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_transfers" ADD CONSTRAINT "disposal_transfers_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_transfers" ADD CONSTRAINT "disposal_transfers_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_transfer_items" ADD CONSTRAINT "disposal_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "disposal_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_transfer_items" ADD CONSTRAINT "disposal_transfer_items_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "inventory_adjustments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_transfer_items" ADD CONSTRAINT "disposal_transfer_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_transfer_items" ADD CONSTRAINT "disposal_transfer_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
