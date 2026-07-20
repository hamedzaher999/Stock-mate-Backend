-- CreateIndex
CREATE INDEX "department_queues_status_added_at_idx" ON "department_queues"("status", "added_at");

-- CreateIndex
CREATE INDEX "prescriptions_status_current_cycle_status_current_cycle_end_idx" ON "prescriptions"("status", "current_cycle_status", "current_cycle_end");
