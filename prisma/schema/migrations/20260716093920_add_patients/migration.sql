-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "national_id" TEXT,
    "family_book_number" TEXT,
    "patient_id" TEXT,
    "registered_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patients_national_id_key" ON "patients"("national_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_patient_id_key" ON "patients"("patient_id");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_registered_by_fkey" FOREIGN KEY ("registered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
