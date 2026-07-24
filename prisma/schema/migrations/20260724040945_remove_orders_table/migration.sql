/*
  Warnings:

  - You are about to drop the column `prepared_quantity` on the `department_refill_items` table. All the data in the column will be lost.
  - The `status` column on the `department_refill_requests` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `purchase_order_item_id` on the `purchase_receipt_items` table. All the data in the column will be lost.
  - You are about to drop the column `supplier_id` on the `purchase_receipt_items` table. All the data in the column will be lost.
  - You are about to drop the column `purchase_order_id` on the `purchase_receipts` table. All the data in the column will be lost.
  - You are about to drop the column `committee_approved_quantity` on the `purchase_request_items` table. All the data in the column will be lost.
  - You are about to drop the column `committee_approved_at` on the `purchase_requests` table. All the data in the column will be lost.
  - You are about to drop the column `committee_approved_by` on the `purchase_requests` table. All the data in the column will be lost.
  - You are about to drop the column `committee_marked_ready_at` on the `purchase_requests` table. All the data in the column will be lost.
  - You are about to drop the column `committee_marked_ready_by` on the `purchase_requests` table. All the data in the column will be lost.
  - You are about to drop the column `committee_rejection_reason` on the `purchase_requests` table. All the data in the column will be lost.
  - The `status` column on the `purchase_requests` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `purchase_order_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `purchase_orders` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[purchase_receipt_id,purchase_request_item_id]` on the table `purchase_receipt_items` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `purchase_request_item_id` to the `purchase_receipt_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supplier_id` to the `purchase_receipts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "request_status" AS ENUM ('draft', 'pending_hospital_approval', 'pending_manager_approval', 'hospital_rejected', 'manager_rejected', 'preparing', 'complete', 'partially_complete', 'cancelled');

-- CreateEnum
CREATE TYPE "batch_type" AS ENUM ('batch', 'final_batch');

-- DropForeignKey
ALTER TABLE "purchase_order_items" DROP CONSTRAINT "purchase_order_items_purchase_order_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_order_items" DROP CONSTRAINT "purchase_order_items_purchase_request_item_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_order_items" DROP CONSTRAINT "purchase_order_items_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_created_by_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_destination_department_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_purchase_request_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_receipt_items" DROP CONSTRAINT "purchase_receipt_items_purchase_order_item_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_receipt_items" DROP CONSTRAINT "purchase_receipt_items_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_receipts" DROP CONSTRAINT "purchase_receipts_purchase_order_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_committee_approved_by_fkey";

-- DropForeignKey
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_committee_marked_ready_by_fkey";

-- DropIndex
DROP INDEX "purchase_receipt_items_purchase_receipt_id_purchase_order_i_key";

-- AlterTable
ALTER TABLE "department_refill_deliveries" ADD COLUMN     "type" "batch_type" NOT NULL DEFAULT 'batch';

-- AlterTable
ALTER TABLE "department_refill_items" DROP COLUMN "prepared_quantity",
ADD COLUMN     "approved_quantity" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "department_refill_requests" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" UUID,
ADD COLUMN     "rejection_reason" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "request_status" NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "purchase_receipt_items" DROP COLUMN "purchase_order_item_id",
DROP COLUMN "supplier_id",
ADD COLUMN     "purchase_request_item_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "purchase_receipts" DROP COLUMN "purchase_order_id",
ADD COLUMN     "supplier_id" UUID NOT NULL,
ADD COLUMN     "type" "batch_type" NOT NULL DEFAULT 'batch';

-- AlterTable
ALTER TABLE "purchase_request_items" DROP COLUMN "committee_approved_quantity",
ADD COLUMN     "approved_quantity" DECIMAL(65,30),
ADD COLUMN     "quantity_discrepancy" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "purchase_requests" DROP COLUMN "committee_approved_at",
DROP COLUMN "committee_approved_by",
DROP COLUMN "committee_marked_ready_at",
DROP COLUMN "committee_marked_ready_by",
DROP COLUMN "committee_rejection_reason",
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" UUID,
ADD COLUMN     "rejection_reason" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "request_status" NOT NULL DEFAULT 'draft';

-- DropTable
DROP TABLE "purchase_order_items";

-- DropTable
DROP TABLE "purchase_orders";

-- DropEnum
DROP TYPE "purchase_order_status";

-- DropEnum
DROP TYPE "purchase_request_status";

-- DropEnum
DROP TYPE "refill_request_status";

-- CreateIndex
CREATE INDEX "department_refill_requests_department_id_status_idx" ON "department_refill_requests"("department_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipt_items_purchase_receipt_id_purchase_request_key" ON "purchase_receipt_items"("purchase_receipt_id", "purchase_request_item_id");

-- AddForeignKey
ALTER TABLE "department_refill_requests" ADD CONSTRAINT "department_refill_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_purchase_request_item_id_fkey" FOREIGN KEY ("purchase_request_item_id") REFERENCES "purchase_request_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
