-- AlterEnum
ALTER TYPE "UsageMetric" ADD VALUE 'COMPARE_DOMAINS';

-- CreateTable
CREATE TABLE "compare_domain_cache" (
    "id" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compare_domain_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compare_domain_cache_cache_key_key" ON "compare_domain_cache"("cache_key");
