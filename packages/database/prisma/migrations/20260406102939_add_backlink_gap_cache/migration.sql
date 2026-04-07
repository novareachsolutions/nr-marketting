-- AlterEnum
ALTER TYPE "UsageMetric" ADD VALUE 'BACKLINK_GAP';

-- CreateTable
CREATE TABLE "backlink_gap_cache" (
    "id" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backlink_gap_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "backlink_gap_cache_cache_key_key" ON "backlink_gap_cache"("cache_key");
