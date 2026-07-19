/*
  Warnings:

  - A unique constraint covering the columns `[name,parent_category_id]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[family_book_number,full_name]` on the table `patients` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,phone]` on the table `suppliers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,email]` on the table `suppliers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `units` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "categories_name_parent_category_id_key" ON "categories"("name", "parent_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_family_book_number_full_name_key" ON "patients"("family_book_number", "full_name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_phone_key" ON "suppliers"("name", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_email_key" ON "suppliers"("name", "email");

-- CreateIndex
CREATE UNIQUE INDEX "units_name_key" ON "units"("name");
