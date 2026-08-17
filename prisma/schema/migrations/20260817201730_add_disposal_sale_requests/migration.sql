-- CreateEnum
CREATE TYPE "disposal_sale_request_status" AS ENUM ('pending_approval', 'awaiting_confirmation', 'rejected', 'completed', 'cancelled');

-- AlterEnum
ALTER TYPE "reference_type" ADD VALUE 'disposal_sale_request';

-- AlterEnum
ALTER TYPE "transaction_type" ADD VALUE 'disposal_sale_out';

-- CreateTable
CREATE TABLE "destinations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disposal_sale_requests" (
    "id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "status" "disposal_sale_request_status" NOT NULL DEFAULT 'pending_approval',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "disposal_sale_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disposal_sale_request_items" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "disposal_sale_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disposal_sale_request_images" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "image_key" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disposal_sale_request_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "destinations_name_phone_key" ON "destinations"("name", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "destinations_name_email_key" ON "destinations"("name", "email");

-- CreateIndex
CREATE INDEX "disposal_sale_requests_status_idx" ON "disposal_sale_requests"("status");

-- CreateIndex
CREATE INDEX "disposal_sale_requests_destination_id_idx" ON "disposal_sale_requests"("destination_id");

-- CreateIndex
CREATE INDEX "disposal_sale_request_images_request_id_sort_order_idx" ON "disposal_sale_request_images"("request_id", "sort_order");

-- AddForeignKey
ALTER TABLE "disposal_sale_requests" ADD CONSTRAINT "disposal_sale_requests_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_sale_requests" ADD CONSTRAINT "disposal_sale_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_sale_requests" ADD CONSTRAINT "disposal_sale_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_sale_requests" ADD CONSTRAINT "disposal_sale_requests_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_sale_request_items" ADD CONSTRAINT "disposal_sale_request_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "disposal_sale_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_sale_request_items" ADD CONSTRAINT "disposal_sale_request_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_sale_request_items" ADD CONSTRAINT "disposal_sale_request_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_sale_request_images" ADD CONSTRAINT "disposal_sale_request_images_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "disposal_sale_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
