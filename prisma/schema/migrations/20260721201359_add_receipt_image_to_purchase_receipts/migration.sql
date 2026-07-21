/*
  Warnings:

  - Added the required column `receipt_image_url` to the `purchase_receipts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "purchase_receipts" ADD COLUMN     "receipt_image_public_id" TEXT,
ADD COLUMN     "receipt_image_url" TEXT NOT NULL;
