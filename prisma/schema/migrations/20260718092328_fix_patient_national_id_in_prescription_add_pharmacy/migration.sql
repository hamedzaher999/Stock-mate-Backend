/*
  Warnings:

  - You are about to drop the column `patient_card_id` on the `prescriptions` table. All the data in the column will be lost.
  - You are about to drop the column `patient_national_id` on the `prescriptions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "prescriptions" DROP COLUMN "patient_card_id",
DROP COLUMN "patient_national_id";

-- CreateTable
CREATE TABLE "pharmacy_dispense_queue" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "national_id" TEXT,
    "family_book_number" TEXT,
    "patient_name" TEXT NOT NULL,
    "prescription_id" UUID NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "medication_summary" TEXT,
    "status" "cycle_status" NOT NULL DEFAULT 'ready',
    "ready_since" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "pharmacy_dispense_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_dispense_queue_prescription_id_key" ON "pharmacy_dispense_queue"("prescription_id");

-- CreateIndex
CREATE INDEX "pharmacy_dispense_queue_national_id_idx" ON "pharmacy_dispense_queue"("national_id");

-- CreateIndex
CREATE INDEX "pharmacy_dispense_queue_family_book_number_idx" ON "pharmacy_dispense_queue"("family_book_number");

-- CreateIndex
CREATE INDEX "pharmacy_dispense_queue_patient_id_idx" ON "pharmacy_dispense_queue"("patient_id");

-- AddForeignKey
ALTER TABLE "pharmacy_dispense_queue" ADD CONSTRAINT "pharmacy_dispense_queue_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispense_queue" ADD CONSTRAINT "pharmacy_dispense_queue_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
