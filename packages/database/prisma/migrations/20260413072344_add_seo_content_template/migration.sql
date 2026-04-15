-- CreateTable
CREATE TABLE "seo_content_briefs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "target_keywords" JSONB NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "top_rivals" JSONB NOT NULL,
    "backlink_targets" JSONB NOT NULL,
    "semantic_keywords" JSONB NOT NULL,
    "avg_readability" INTEGER NOT NULL,
    "recommended_word_count" INTEGER NOT NULL,
    "title_suggestion" TEXT NOT NULL,
    "meta_suggestion" TEXT NOT NULL,
    "h1_suggestion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_content_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_brief_cache" (
    "id" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_brief_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seo_content_briefs_user_id_updated_at_idx" ON "seo_content_briefs"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "seo_content_briefs_project_id_idx" ON "seo_content_briefs"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "seo_brief_cache_cache_key_key" ON "seo_brief_cache"("cache_key");

-- AddForeignKey
ALTER TABLE "seo_content_briefs" ADD CONSTRAINT "seo_content_briefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_content_briefs" ADD CONSTRAINT "seo_content_briefs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
