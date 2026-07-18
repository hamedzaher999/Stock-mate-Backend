-- CreateEnum
CREATE TYPE "refill_request_priority" AS ENUM ('normal', 'urgent');

-- CreateEnum
CREATE TYPE "periodic_schedule_status" AS ENUM ('pending_hospital_approval', 'active', 'paused', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "schedule_approval_policy" AS ENUM ('auto_approved', 'approval_required_each_cycle');

-- AlterTable
ALTER TABLE "department_refill_requests" ADD COLUMN     "periodic_schedule_id" UUID,
ADD COLUMN     "priority" "refill_request_priority" NOT NULL DEFAULT 'normal';

-- CreateTable
CREATE TABLE "periodic_refill_schedules" (
    "id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "status" "periodic_schedule_status" NOT NULL DEFAULT 'pending_hospital_approval',
    "approval_policy" "schedule_approval_policy",
    "priority" "refill_request_priority" NOT NULL DEFAULT 'normal',
    "frequency_unit" "frequency_unit" NOT NULL,
    "frequency_interval" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "next_run_date" DATE NOT NULL,
    "last_generated_at" TIMESTAMP(3),
    "hospital_approved_by" UUID,
    "hospital_approved_at" TIMESTAMP(3),
    "hospital_rejection_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "periodic_refill_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodic_refill_schedule_items" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "requested_quantity" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "periodic_refill_schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "periodic_refill_schedules_status_next_run_date_idx" ON "periodic_refill_schedules"("status", "next_run_date");

-- CreateIndex
CREATE INDEX "periodic_refill_schedules_department_id_status_idx" ON "periodic_refill_schedules"("department_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "periodic_refill_schedule_items_schedule_id_variant_id_key" ON "periodic_refill_schedule_items"("schedule_id", "variant_id");

-- CreateIndex
CREATE INDEX "department_refill_requests_department_id_status_idx" ON "department_refill_requests"("department_id", "status");

-- CreateIndex
CREATE INDEX "department_refill_requests_periodic_schedule_id_idx" ON "department_refill_requests"("periodic_schedule_id");

-- AddForeignKey
ALTER TABLE "department_refill_requests" ADD CONSTRAINT "department_refill_requests_periodic_schedule_id_fkey" FOREIGN KEY ("periodic_schedule_id") REFERENCES "periodic_refill_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodic_refill_schedules" ADD CONSTRAINT "periodic_refill_schedules_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodic_refill_schedules" ADD CONSTRAINT "periodic_refill_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodic_refill_schedules" ADD CONSTRAINT "periodic_refill_schedules_hospital_approved_by_fkey" FOREIGN KEY ("hospital_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodic_refill_schedule_items" ADD CONSTRAINT "periodic_refill_schedule_items_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "periodic_refill_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodic_refill_schedule_items" ADD CONSTRAINT "periodic_refill_schedule_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
