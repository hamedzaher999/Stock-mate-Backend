-- CreateEnum
CREATE TYPE "prescription_status" AS ENUM ('active', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "cycle_status" AS ENUM ('ready', 'partially_delivered', 'delivered', 'missed', 'cancelled');

-- CreateEnum
CREATE TYPE "frequency_unit" AS ENUM ('day', 'week', 'month');

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL,
    "visit_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "status" "prescription_status" NOT NULL DEFAULT 'active',
    "frequency_unit" "frequency_unit",
    "frequency_interval" INTEGER,
    "start_date" DATE NOT NULL,
    "total_cycles" INTEGER,
    "current_cycle_number" INTEGER NOT NULL DEFAULT 1,
    "current_cycle_start" DATE NOT NULL,
    "current_cycle_end" DATE NOT NULL,
    "current_cycle_status" "cycle_status" NOT NULL DEFAULT 'ready',
    "renewed_from_prescription_id" UUID,
    "cancel_reason" TEXT,
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "prescribed_quantity" DECIMAL(65,30) NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "duration_days" INTEGER,
    "dispensed_quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_cycle_log" (
    "id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "resolved_status" "cycle_status" NOT NULL,
    "resolved_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_cycle_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prescription_cycle_log_prescription_id_cycle_number_key" ON "prescription_cycle_log"("prescription_id", "cycle_number");

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "medical_visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_renewed_from_prescription_id_fkey" FOREIGN KEY ("renewed_from_prescription_id") REFERENCES "prescriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_cycle_log" ADD CONSTRAINT "prescription_cycle_log_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
