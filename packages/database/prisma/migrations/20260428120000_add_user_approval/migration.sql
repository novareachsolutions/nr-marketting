-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "approved_at" TIMESTAMP(3),
  ADD COLUMN "approved_by_id" TEXT,
  ADD COLUMN "rejected_at" TIMESTAMP(3),
  ADD COLUMN "rejection_reason" TEXT;

-- Backfill: existing users with verified email are auto-approved so they don't lose access
UPDATE "users"
SET "approval_status" = 'APPROVED',
    "approved_at" = COALESCE("updated_at", "created_at")
WHERE "is_email_verified" = TRUE;

-- Existing super-admins are always approved
UPDATE "users"
SET "approval_status" = 'APPROVED',
    "approved_at" = COALESCE("approved_at", "updated_at", "created_at")
WHERE "role" = 'SUPER_ADMIN';
