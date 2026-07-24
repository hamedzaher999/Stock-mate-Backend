/*
  Warnings:

  - You are about to drop the column `hospital_approved_at` on the `periodic_refill_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `hospital_approved_by` on the `periodic_refill_schedules` table. All the data in the column will be lost.
  - Added the required column `approved_at` to the `periodic_refill_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `approved_by` to the `periodic_refill_schedules` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "periodic_refill_schedules" DROP CONSTRAINT "periodic_refill_schedules_hospital_approved_by_fkey";

-- AlterTable
ALTER TABLE "periodic_refill_schedules" DROP COLUMN "hospital_approved_at",
DROP COLUMN "hospital_approved_by",
ADD COLUMN     "approved_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "approved_by" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "periodic_refill_schedules" ADD CONSTRAINT "periodic_refill_schedules_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
