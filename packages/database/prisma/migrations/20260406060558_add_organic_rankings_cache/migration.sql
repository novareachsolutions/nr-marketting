-- AlterEnum
ALTER TYPE "UsageMetric" ADD VALUE 'ORGANIC_RANKINGS';

-- CreateTable
CREATE TABLE "organic_rankings_cache" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organic_rankings_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organic_rankings_cache_domain_country_key" ON "organic_rankings_cache"("domain", "country");
