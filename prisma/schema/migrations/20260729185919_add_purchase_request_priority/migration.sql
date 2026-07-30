-- AlterTable
ALTER TABLE "purchase_requests" ADD COLUMN     "priority" "refill_request_priority" NOT NULL DEFAULT 'normal';
