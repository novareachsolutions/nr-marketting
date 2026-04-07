-- AlterEnum
ALTER TYPE "UsageMetric" ADD VALUE 'KEYWORD_GAP';

-- CreateTable
CREATE TABLE "keyword_gap_cache" (
    "id" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_gap_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "keyword_gap_cache_cache_key_key" ON "keyword_gap_cache"("cache_key");
