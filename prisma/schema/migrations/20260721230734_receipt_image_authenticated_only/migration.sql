/*
  Warnings:

  - You are about to drop the column `receipt_image_url` on the `purchase_receipts` table. All the data in the column will be lost.
  - Made the column `receipt_image_public_id` on table `purchase_receipts` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "purchase_receipts" DROP COLUMN "receipt_image_url",
ALTER COLUMN "receipt_image_public_id" SET NOT NULL;
