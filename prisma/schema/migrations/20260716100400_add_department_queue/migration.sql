-- CreateEnum
CREATE TYPE "queue_status" AS ENUM ('waiting', 'in_consultation', 'completed', 'removed');

-- CreateTable
CREATE TABLE "department_queues" (
    "id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "status" "queue_status" NOT NULL DEFAULT 'waiting',
    "added_by" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_by" UUID,
    "locked_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "removed_by" UUID,
    "removed_reason" TEXT,

    CONSTRAINT "department_queues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_queues_department_id_status_idx" ON "department_queues"("department_id", "status");

-- AddForeignKey
ALTER TABLE "department_queues" ADD CONSTRAINT "department_queues_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_queues" ADD CONSTRAINT "department_queues_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_queues" ADD CONSTRAINT "department_queues_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_queues" ADD CONSTRAINT "department_queues_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_queues" ADD CONSTRAINT "department_queues_removed_by_fkey" FOREIGN KEY ("removed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
