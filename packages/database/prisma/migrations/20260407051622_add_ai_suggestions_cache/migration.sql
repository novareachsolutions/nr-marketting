-- AlterEnum
ALTER TYPE "UsageMetric" ADD VALUE 'AI_SUGGESTIONS';

-- CreateTable
CREATE TABLE "ai_suggestions_cache" (
    "id" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_suggestions_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_suggestions_cache_cache_key_key" ON "ai_suggestions_cache"("cache_key");
