-- AlterEnum
ALTER TYPE "UsageMetric" ADD VALUE 'DOMAIN_OVERVIEWS';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "last_rank_check_at" TIMESTAMP(3),
ADD COLUMN     "rank_check_schedule" "CrawlSchedule" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "ranking_history" ADD COLUMN     "ranking_url" TEXT,
ADD COLUMN     "serp_features" TEXT;

-- AlterTable
ALTER TABLE "tracked_keywords" ADD COLUMN     "search_volume" INTEGER;

-- CreateTable
CREATE TABLE "domain_overview_cache" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "authority_score" INTEGER,
    "authority_trend" JSONB,
    "organic_keywords" INTEGER,
    "organic_traffic" INTEGER,
    "organic_traffic_cost" DOUBLE PRECISION,
    "organic_traffic_trend" JSONB,
    "paid_keywords" INTEGER,
    "paid_traffic" INTEGER,
    "paid_traffic_cost" DOUBLE PRECISION,
    "total_backlinks" INTEGER,
    "referring_domains" INTEGER,
    "follow_backlinks" INTEGER,
    "nofollow_backlinks" INTEGER,
    "intent_distribution" JSONB,
    "position_distribution" JSONB,
    "top_organic_keywords" JSONB,
    "top_organic_pages" JSONB,
    "top_competitors" JSONB,
    "country_distribution" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_overview_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_tags" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracked_keyword_tags" (
    "tracked_keyword_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "tracked_keyword_tags_pkey" PRIMARY KEY ("tracked_keyword_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domain_overview_cache_domain_country_key" ON "domain_overview_cache"("domain", "country");

-- CreateIndex
CREATE INDEX "keyword_tags_project_id_idx" ON "keyword_tags"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_tags_project_id_name_key" ON "keyword_tags"("project_id", "name");

-- AddForeignKey
ALTER TABLE "keyword_tags" ADD CONSTRAINT "keyword_tags_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_keyword_tags" ADD CONSTRAINT "tracked_keyword_tags_tracked_keyword_id_fkey" FOREIGN KEY ("tracked_keyword_id") REFERENCES "tracked_keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_keyword_tags" ADD CONSTRAINT "tracked_keyword_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "keyword_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
