/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Enforce: at least one of phone or email must be present
ALTER TABLE "users"
ADD CONSTRAINT "users_phone_or_email_required"
CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL);