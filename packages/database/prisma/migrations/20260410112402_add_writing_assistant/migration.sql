-- AlterEnum
ALTER TYPE "UsageMetric" ADD VALUE 'SEO_WRITING_ASSISTANT';

-- CreateTable
CREATE TABLE "writing_documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "content" TEXT NOT NULL,
    "plain_text" TEXT NOT NULL,
    "target_keywords" JSONB,
    "meta_description" TEXT,
    "readability_score" DOUBLE PRECISION,
    "seo_score" DOUBLE PRECISION,
    "originality_score" DOUBLE PRECISION,
    "tone_score" DOUBLE PRECISION,
    "overall_score" DOUBLE PRECISION,
    "target_tone" TEXT,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "writing_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_ai_cache" (
    "id" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "writing_ai_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "writing_documents_user_id_idx" ON "writing_documents"("user_id");

-- CreateIndex
CREATE INDEX "writing_documents_project_id_idx" ON "writing_documents"("project_id");

-- CreateIndex
CREATE INDEX "writing_documents_user_id_updated_at_idx" ON "writing_documents"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "writing_ai_cache_cache_key_key" ON "writing_ai_cache"("cache_key");

-- AddForeignKey
ALTER TABLE "writing_documents" ADD CONSTRAINT "writing_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_documents" ADD CONSTRAINT "writing_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
