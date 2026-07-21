/*
  Warnings:

  - Added the required column `destination_department_id` to the `purchase_orders` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "purchase_receipt_status" AS ENUM ('pending_confirmation', 'confirmed');

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "destination_department_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "purchase_receipt_items" ADD COLUMN     "confirmed_quantity" DECIMAL(65,30),
ADD COLUMN     "confirmed_quantity_discrepancy" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "purchase_receipts" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "confirmed_by" UUID,
ADD COLUMN     "status" "purchase_receipt_status" NOT NULL DEFAULT 'pending_confirmation';

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_destination_department_id_fkey" FOREIGN KEY ("destination_department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
