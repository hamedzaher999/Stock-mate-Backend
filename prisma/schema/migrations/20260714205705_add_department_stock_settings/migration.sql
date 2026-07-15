-- CreateTable
CREATE TABLE "department_stock_settings" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "storage_location" TEXT,
    "minimum_stock" DECIMAL(65,30),
    "maximum_stock" DECIMAL(65,30),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "department_stock_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "department_stock_settings_variant_id_department_id_key" ON "department_stock_settings"("variant_id", "department_id");

-- AddForeignKey
ALTER TABLE "department_stock_settings" ADD CONSTRAINT "department_stock_settings_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_stock_settings" ADD CONSTRAINT "department_stock_settings_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_stock_settings" ADD CONSTRAINT "department_stock_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
