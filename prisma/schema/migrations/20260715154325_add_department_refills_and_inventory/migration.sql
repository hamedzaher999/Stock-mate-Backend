-- CreateEnum
CREATE TYPE "refill_request_status" AS ENUM ('draft', 'pending_hospital_approval', 'approved', 'preparing', 'ready_for_delivery', 'delivered', 'partially_delivered', 'cancelled');

-- CreateTable
CREATE TABLE "department_refill_requests" (
    "id" UUID NOT NULL,
    "request_number" TEXT NOT NULL,
    "department_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "status" "refill_request_status" NOT NULL DEFAULT 'draft',
    "hospital_approved_by" UUID,
    "hospital_approved_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "department_refill_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_refill_items" (
    "id" UUID NOT NULL,
    "refill_request_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "requested_quantity" DECIMAL(65,30) NOT NULL,
    "prepared_quantity" DECIMAL(65,30),
    "delivered_quantity" DECIMAL(65,30),
    "quantity_discrepancy" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_refill_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_refill_deliveries" (
    "id" UUID NOT NULL,
    "refill_request_id" UUID NOT NULL,
    "delivered_by" UUID NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by" UUID,
    "confirmed_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "department_refill_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_refill_delivery_items" (
    "id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "refill_item_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "shipped_quantity" DECIMAL(65,30) NOT NULL,
    "received_quantity" DECIMAL(65,30),
    "quantity_discrepancy" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "department_refill_delivery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_inventory" (
    "id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "current_quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "last_refill_quantity" DECIMAL(65,30),
    "last_refill_date" DATE,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "department_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "department_refill_requests_request_number_key" ON "department_refill_requests"("request_number");

-- CreateIndex
CREATE UNIQUE INDEX "department_inventory_department_id_variant_id_key" ON "department_inventory"("department_id", "variant_id");

-- AddForeignKey
ALTER TABLE "department_refill_requests" ADD CONSTRAINT "department_refill_requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_refill_requests" ADD CONSTRAINT "department_refill_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_refill_requests" ADD CONSTRAINT "department_refill_requests_hospital_approved_by_fkey" FOREIGN KEY ("hospital_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_refill_items" ADD CONSTRAINT "department_refill_items_refill_request_id_fkey" FOREIGN KEY ("refill_request_id") REFERENCES "department_refill_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_refill_items" ADD CONSTRAINT "department_refill_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_refill_deliveries" ADD CONSTRAINT "department_refill_deliveries_refill_request_id_fkey" FOREIGN KEY ("refill_request_id") REFERENCES "department_refill_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_refill_deliveries" ADD CONSTRAINT "department_refill_deliveries_delivered_by_fkey" FOREIGN KEY ("delivered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_refill_deliveries" ADD CONSTRAINT "department_refill_deliveries_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_refill_delivery_items" ADD CONSTRAINT "department_refill_delivery_items_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "department_refill_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_refill_delivery_items" ADD CONSTRAINT "department_refill_delivery_items_refill_item_id_fkey" FOREIGN KEY ("refill_item_id") REFERENCES "department_refill_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_refill_delivery_items" ADD CONSTRAINT "department_refill_delivery_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_inventory" ADD CONSTRAINT "department_inventory_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_inventory" ADD CONSTRAINT "department_inventory_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
