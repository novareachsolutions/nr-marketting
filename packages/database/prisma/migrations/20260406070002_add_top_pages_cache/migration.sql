-- AlterEnum
ALTER TYPE "UsageMetric" ADD VALUE 'TOP_PAGES';

-- CreateTable
CREATE TABLE "top_pages_cache" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "top_pages_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "top_pages_cache_domain_country_key" ON "top_pages_cache"("domain", "country");
