-- CreateIndex
CREATE INDEX "inventory_adjustments_department_id_created_at_idx" ON "inventory_adjustments"("department_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_adjustments_variant_id_idx" ON "inventory_adjustments"("variant_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_department_id_transaction_date_idx" ON "inventory_transactions"("department_id", "transaction_date");

-- CreateIndex
CREATE INDEX "inventory_transactions_variant_id_transaction_date_idx" ON "inventory_transactions"("variant_id", "transaction_date");

-- CreateIndex
CREATE INDEX "inventory_transactions_batch_id_idx" ON "inventory_transactions"("batch_id");

-- CreateIndex
CREATE INDEX "medical_visits_patient_id_idx" ON "medical_visits"("patient_id");

-- CreateIndex
CREATE INDEX "medical_visits_doctor_id_idx" ON "medical_visits"("doctor_id");

-- CreateIndex
CREATE INDEX "medical_visits_department_id_status_idx" ON "medical_visits"("department_id", "status");

-- CreateIndex
CREATE INDEX "otp_codes_user_id_created_at_idx" ON "otp_codes"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");
