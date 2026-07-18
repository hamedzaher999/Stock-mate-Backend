/*
  Warnings:

  - The values [pending_hospital_approval,paused,rejected] on the enum `periodic_schedule_status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `frequency_unit` on the `periodic_refill_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `hospital_rejection_reason` on the `periodic_refill_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `periodic_refill_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `periodic_refill_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `start_date` on the `periodic_refill_schedules` table. All the data in the column will be lost.
  - You are about to drop the `periodic_refill_schedule_items` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[origin_request_id]` on the table `periodic_refill_schedules` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `origin_request_id` to the `periodic_refill_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `request_type` to the `periodic_refill_schedules` table without a default value. This is not possible if the table is not empty.
  - Made the column `approval_policy` on table `periodic_refill_schedules` required. This step will fail if there are existing NULL values in that column.
  - Made the column `hospital_approved_by` on table `periodic_refill_schedules` required. This step will fail if there are existing NULL values in that column.
  - Made the column `hospital_approved_at` on table `periodic_refill_schedules` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "refill_request_type" AS ENUM ('normal', 'daily', 'weekly', 'monthly');

-- AlterEnum
BEGIN;
CREATE TYPE "periodic_schedule_status_new" AS ENUM ('active', 'cancelled');
ALTER TABLE "public"."periodic_refill_schedules" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "periodic_refill_schedules" ALTER COLUMN "status" TYPE "periodic_schedule_status_new" USING ("status"::text::"periodic_schedule_status_new");
ALTER TYPE "periodic_schedule_status" RENAME TO "periodic_schedule_status_old";
ALTER TYPE "periodic_schedule_status_new" RENAME TO "periodic_schedule_status";
DROP TYPE "public"."periodic_schedule_status_old";
ALTER TABLE "periodic_refill_schedules" ALTER COLUMN "status" SET DEFAULT 'active';
COMMIT;

-- DropForeignKey
ALTER TABLE "periodic_refill_schedule_items" DROP CONSTRAINT "periodic_refill_schedule_items_schedule_id_fkey";

-- DropForeignKey
ALTER TABLE "periodic_refill_schedule_items" DROP CONSTRAINT "periodic_refill_schedule_items_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "periodic_refill_schedules" DROP CONSTRAINT "periodic_refill_schedules_hospital_approved_by_fkey";

-- AlterTable
ALTER TABLE "department_refill_requests" ADD COLUMN     "frequency_interval" INTEGER,
ADD COLUMN     "request_type" "refill_request_type" NOT NULL DEFAULT 'normal';

-- AlterTable
ALTER TABLE "periodic_refill_schedules" DROP COLUMN "frequency_unit",
DROP COLUMN "hospital_rejection_reason",
DROP COLUMN "notes",
DROP COLUMN "priority",
DROP COLUMN "start_date",
ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by" UUID,
ADD COLUMN     "origin_request_id" UUID NOT NULL,
ADD COLUMN     "request_type" "refill_request_type" NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'active',
ALTER COLUMN "approval_policy" SET NOT NULL,
ALTER COLUMN "hospital_approved_by" SET NOT NULL,
ALTER COLUMN "hospital_approved_at" SET NOT NULL;

-- DropTable
DROP TABLE "periodic_refill_schedule_items";

-- CreateIndex
CREATE UNIQUE INDEX "periodic_refill_schedules_origin_request_id_key" ON "periodic_refill_schedules"("origin_request_id");

-- AddForeignKey
ALTER TABLE "periodic_refill_schedules" ADD CONSTRAINT "periodic_refill_schedules_hospital_approved_by_fkey" FOREIGN KEY ("hospital_approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodic_refill_schedules" ADD CONSTRAINT "periodic_refill_schedules_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodic_refill_schedules" ADD CONSTRAINT "periodic_refill_schedules_origin_request_id_fkey" FOREIGN KEY ("origin_request_id") REFERENCES "department_refill_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
