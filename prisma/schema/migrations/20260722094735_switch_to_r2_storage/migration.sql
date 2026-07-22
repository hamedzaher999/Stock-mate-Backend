/*
  Warnings:

  - You are about to drop the column `receipt_image_public_id` on the `purchase_receipts` table. All the data in the column will be lost.
  - Added the required column `receipt_image_key` to the `purchase_receipts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "purchase_receipts" DROP COLUMN "receipt_image_public_id",
ADD COLUMN     "receipt_image_key" TEXT NOT NULL;
