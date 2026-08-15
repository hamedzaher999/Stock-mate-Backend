-- CreateIndex
CREATE INDEX "medical_visits_department_id_visit_date_idx" ON "medical_visits"("department_id", "visit_date");

-- CreateIndex
CREATE INDEX "medical_visits_visit_date_idx" ON "medical_visits"("visit_date");
