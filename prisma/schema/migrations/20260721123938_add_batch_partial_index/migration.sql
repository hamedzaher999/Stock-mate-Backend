CREATE INDEX "batch_stock_dept_qty_positive_idx"
ON "batch_stock" ("department_id")
WHERE "quantity" > 0;