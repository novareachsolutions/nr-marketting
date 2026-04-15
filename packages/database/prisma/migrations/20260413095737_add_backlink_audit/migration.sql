-- AlterEnum
ALTER TYPE "UsageMetric" ADD VALUE 'BACKLINK_AUDIT';

-- CreateTable
CREATE TABLE "backlink_audit_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "toxicity_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "authority_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_links" INTEGER NOT NULL DEFAULT 0,
    "total_domains" INTEGER NOT NULL DEFAULT 0,
    "toxic_count" INTEGER NOT NULL DEFAULT 0,
    "suspicious_count" INTEGER NOT NULL DEFAULT 0,
    "clean_count" INTEGER NOT NULL DEFAULT 0,
    "insights" JSONB,
    "distribution" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backlink_audit_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backlink_audit_links" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_title" TEXT,
    "source_domain" TEXT NOT NULL,
    "target_url" TEXT NOT NULL,
    "anchor" TEXT NOT NULL,
    "link_type" TEXT NOT NULL DEFAULT 'follow',
    "category" TEXT,
    "tld" TEXT,
    "first_seen" TEXT,
    "source_authority" INTEGER NOT NULL DEFAULT 0,
    "toxicity_score" INTEGER NOT NULL DEFAULT 0,
    "toxicity_level" TEXT NOT NULL DEFAULT 'clean',
    "risk_factors" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "user_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backlink_audit_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backlink_audit_jobs_user_id_idx" ON "backlink_audit_jobs"("user_id");

-- CreateIndex
CREATE INDEX "backlink_audit_jobs_domain_idx" ON "backlink_audit_jobs"("domain");

-- CreateIndex
CREATE INDEX "backlink_audit_jobs_created_at_idx" ON "backlink_audit_jobs"("created_at");

-- CreateIndex
CREATE INDEX "backlink_audit_links_job_id_idx" ON "backlink_audit_links"("job_id");

-- CreateIndex
CREATE INDEX "backlink_audit_links_job_id_status_idx" ON "backlink_audit_links"("job_id", "status");

-- CreateIndex
CREATE INDEX "backlink_audit_links_job_id_toxicity_level_idx" ON "backlink_audit_links"("job_id", "toxicity_level");

-- AddForeignKey
ALTER TABLE "backlink_audit_jobs" ADD CONSTRAINT "backlink_audit_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backlink_audit_links" ADD CONSTRAINT "backlink_audit_links_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "backlink_audit_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
