/*
  Warnings:

  - You are about to drop the column `receipt_image_key` on the `purchase_receipts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "purchase_receipts" DROP COLUMN "receipt_image_key";

-- CreateTable
CREATE TABLE "purchase_receipt_images" (
    "id" UUID NOT NULL,
    "purchase_receipt_id" UUID NOT NULL,
    "image_key" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_receipt_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_receipt_images_purchase_receipt_id_sort_order_idx" ON "purchase_receipt_images"("purchase_receipt_id", "sort_order");

-- AddForeignKey
ALTER TABLE "purchase_receipt_images" ADD CONSTRAINT "purchase_receipt_images_purchase_receipt_id_fkey" FOREIGN KEY ("purchase_receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
