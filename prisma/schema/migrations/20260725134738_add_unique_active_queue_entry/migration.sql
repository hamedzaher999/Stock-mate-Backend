
CREATE UNIQUE INDEX "department_queues_active_patient_unique"
ON "department_queues" ("department_id", "patient_id")
WHERE "status" IN ('waiting', 'in_consultation');