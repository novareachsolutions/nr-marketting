-- CreateTable
CREATE TABLE "backlinks_cache" (
    "id" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backlinks_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "backlinks_cache_cache_key_key" ON "backlinks_cache"("cache_key");
