-- CreateTable
CREATE TABLE "prescription_dispenses" (
    "id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "dispensed_by" UUID NOT NULL,
    "dispensed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "prescription_dispenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_dispense_items" (
    "id" UUID NOT NULL,
    "dispense_id" UUID NOT NULL,
    "prescription_item_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "prescription_dispense_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "prescription_dispenses" ADD CONSTRAINT "prescription_dispenses_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_dispenses" ADD CONSTRAINT "prescription_dispenses_dispensed_by_fkey" FOREIGN KEY ("dispensed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_dispense_items" ADD CONSTRAINT "prescription_dispense_items_dispense_id_fkey" FOREIGN KEY ("dispense_id") REFERENCES "prescription_dispenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_dispense_items" ADD CONSTRAINT "prescription_dispense_items_prescription_item_id_fkey" FOREIGN KEY ("prescription_item_id") REFERENCES "prescription_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_dispense_items" ADD CONSTRAINT "prescription_dispense_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_dispense_items" ADD CONSTRAINT "prescription_dispense_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
