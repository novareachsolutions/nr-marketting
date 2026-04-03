-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'AGENCY');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIALING');

-- CreateEnum
CREATE TYPE "UsageMetric" AS ENUM ('KEYWORDS_TRACKED', 'PAGES_CRAWLED', 'AI_CREDITS', 'REPORTS_GENERATED');

-- CreateEnum
CREATE TYPE "Device" AS ENUM ('DESKTOP', 'MOBILE');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('GSC', 'DATAFORSEO');

-- CreateEnum
CREATE TYPE "CrawlStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('MISSING_TITLE', 'MISSING_H1', 'BROKEN_INTERNAL_LINK', 'PAGE_NOT_FOUND', 'SERVER_ERROR', 'HAS_NOINDEX', 'REDIRECT_CHAIN', 'MISSING_META_DESCRIPTION', 'DUPLICATE_TITLE', 'DUPLICATE_META_DESCRIPTION', 'IMAGE_MISSING_ALT', 'SLOW_PAGE', 'MULTIPLE_H1', 'MISSING_CANONICAL', 'TITLE_TOO_LONG', 'TITLE_TOO_SHORT', 'META_DESCRIPTION_TOO_LONG', 'META_DESCRIPTION_TOO_SHORT', 'LOW_WORD_COUNT');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('ERROR', 'WARNING', 'NOTICE');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('MANUAL', 'WORDPRESS', 'GITHUB');

-- CreateEnum
CREATE TYPE "WpAuthMethod" AS ENUM ('APP_PASSWORD', 'PLUGIN');

-- CreateEnum
CREATE TYPE "WpSeoPlugin" AS ENUM ('YOAST', 'RANKMATH', 'AIOSEO', 'NONE');

-- CreateEnum
CREATE TYPE "DeployPlatform" AS ENUM ('GITHUB_PAGES', 'VERCEL', 'NETLIFY', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verify_token" TEXT,
    "password_reset_token" TEXT,
    "password_reset_expiry" TIMESTAMP(3),
    "avatar_url" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "status" "SubStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "metric" "UsageMetric" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "limit" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "source_type" "SourceType" NOT NULL DEFAULT 'MANUAL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitors" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wordpress_connections" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "site_url" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "app_password" TEXT,
    "plugin_api_key" TEXT,
    "auth_method" "WpAuthMethod" NOT NULL,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "wp_version" TEXT,
    "seo_plugin" "WpSeoPlugin",
    "capabilities" JSONB,
    "last_verified_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wordpress_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_connections" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "repo_owner" TEXT NOT NULL,
    "repo_name" TEXT NOT NULL,
    "repo_full_name" TEXT NOT NULL,
    "default_branch" TEXT NOT NULL DEFAULT 'main',
    "repo_url" TEXT NOT NULL,
    "deploy_url" TEXT,
    "deploy_platform" "DeployPlatform",
    "webhook_id" TEXT,
    "webhook_secret" TEXT,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "last_verified_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expiry" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "ga_property_id" TEXT,
    "gsc_site_url" TEXT,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_cache" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "search_volume" INTEGER,
    "difficulty" INTEGER,
    "cpc" DOUBLE PRECISION,
    "trend" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_keywords" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "target_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracked_keywords" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "target_url" TEXT,
    "device" "Device" NOT NULL DEFAULT 'DESKTOP',
    "country" TEXT NOT NULL DEFAULT 'US',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_history" (
    "id" TEXT NOT NULL,
    "tracked_keyword_id" TEXT NOT NULL,
    "position" DOUBLE PRECISION,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL,
    "source" "DataSource" NOT NULL DEFAULT 'GSC',

    CONSTRAINT "ranking_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_jobs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" "CrawlStatus" NOT NULL DEFAULT 'QUEUED',
    "pages_crawled" INTEGER NOT NULL DEFAULT 0,
    "pages_total" INTEGER NOT NULL DEFAULT 0,
    "pages_limit" INTEGER NOT NULL,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "notice_count" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_pages" (
    "id" TEXT NOT NULL,
    "crawl_job_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status_code" INTEGER,
    "title" TEXT,
    "meta_description" TEXT,
    "h1" TEXT,
    "h1_count" INTEGER NOT NULL DEFAULT 0,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "load_time_ms" INTEGER,
    "content_type" TEXT,
    "canonical_url" TEXT,
    "has_robots_noindex" BOOLEAN NOT NULL DEFAULT false,
    "has_robots_nofollow" BOOLEAN NOT NULL DEFAULT false,
    "internal_links_count" INTEGER NOT NULL DEFAULT 0,
    "external_links_count" INTEGER NOT NULL DEFAULT 0,
    "images_count" INTEGER NOT NULL DEFAULT 0,
    "images_without_alt" INTEGER NOT NULL DEFAULT 0,
    "crawled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_issues" (
    "id" TEXT NOT NULL,
    "crawl_page_id" TEXT NOT NULL,
    "type" "IssueType" NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "suggestion" TEXT,

    CONSTRAINT "crawl_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ReportType" NOT NULL DEFAULT 'WEEKLY',
    "date_from" TIMESTAMP(3) NOT NULL,
    "date_to" TIMESTAMP(3) NOT NULL,
    "file_path" TEXT,
    "file_size" INTEGER,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_customer_id_key" ON "subscriptions"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "usage_records_user_id_period_idx" ON "usage_records"("user_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_user_id_metric_period_key" ON "usage_records"("user_id", "metric", "period");

-- CreateIndex
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_user_id_domain_key" ON "projects"("user_id", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "competitors_project_id_domain_key" ON "competitors"("project_id", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "wordpress_connections_project_id_key" ON "wordpress_connections"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_connections_project_id_key" ON "github_connections"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "google_connections_user_id_key" ON "google_connections"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_cache_keyword_country_key" ON "keyword_cache"("keyword", "country");

-- CreateIndex
CREATE UNIQUE INDEX "project_keywords_project_id_keyword_key" ON "project_keywords"("project_id", "keyword");

-- CreateIndex
CREATE INDEX "tracked_keywords_project_id_idx" ON "tracked_keywords"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_keywords_project_id_keyword_device_country_key" ON "tracked_keywords"("project_id", "keyword", "device", "country");

-- CreateIndex
CREATE INDEX "ranking_history_tracked_keyword_id_date_idx" ON "ranking_history"("tracked_keyword_id", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ranking_history_tracked_keyword_id_date_source_key" ON "ranking_history"("tracked_keyword_id", "date", "source");

-- CreateIndex
CREATE INDEX "crawl_jobs_project_id_idx" ON "crawl_jobs"("project_id");

-- CreateIndex
CREATE INDEX "crawl_pages_crawl_job_id_status_code_idx" ON "crawl_pages"("crawl_job_id", "status_code");

-- CreateIndex
CREATE INDEX "crawl_issues_crawl_page_id_severity_idx" ON "crawl_issues"("crawl_page_id", "severity");

-- CreateIndex
CREATE INDEX "ai_conversations_project_id_idx" ON "ai_conversations"("project_id");

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_idx" ON "ai_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "reports_project_id_created_at_idx" ON "reports"("project_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wordpress_connections" ADD CONSTRAINT "wordpress_connections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_connections" ADD CONSTRAINT "github_connections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_connections" ADD CONSTRAINT "google_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_keywords" ADD CONSTRAINT "project_keywords_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_keywords" ADD CONSTRAINT "tracked_keywords_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_history" ADD CONSTRAINT "ranking_history_tracked_keyword_id_fkey" FOREIGN KEY ("tracked_keyword_id") REFERENCES "tracked_keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_jobs" ADD CONSTRAINT "crawl_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_pages" ADD CONSTRAINT "crawl_pages_crawl_job_id_fkey" FOREIGN KEY ("crawl_job_id") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_issues" ADD CONSTRAINT "crawl_issues_crawl_page_id_fkey" FOREIGN KEY ("crawl_page_id") REFERENCES "crawl_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
