/*
  Warnings:

  - You are about to drop the `department_inventory` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "transaction_type" ADD VALUE 'department_consumption';

-- DropForeignKey
ALTER TABLE "department_inventory" DROP CONSTRAINT "department_inventory_department_id_fkey";

-- DropForeignKey
ALTER TABLE "department_inventory" DROP CONSTRAINT "department_inventory_variant_id_fkey";

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "tracks_inventory" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "department_inventory";
