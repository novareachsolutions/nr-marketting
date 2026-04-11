-- CreateTable
CREATE TABLE "topic_cache" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "search_volume" INTEGER,
    "difficulty" INTEGER,
    "cpc" DOUBLE PRECISION,
    "topic_efficiency" INTEGER,
    "subtopic_count" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topic_cache_topic_country_key" ON "topic_cache"("topic", "country");
