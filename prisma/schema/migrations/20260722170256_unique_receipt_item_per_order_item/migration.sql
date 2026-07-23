/*
  Warnings:

  - A unique constraint covering the columns `[purchase_receipt_id,purchase_order_item_id]` on the table `purchase_receipt_items` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipt_items_purchase_receipt_id_purchase_order_i_key" ON "purchase_receipt_items"("purchase_receipt_id", "purchase_order_item_id");
