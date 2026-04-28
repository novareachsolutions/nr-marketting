-- CreateEnum
CREATE TYPE "GbpPostType" AS ENUM ('UPDATE', 'OFFER', 'EVENT', 'PRODUCT');

-- CreateEnum
CREATE TYPE "GbpPostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "GbpMetricType" AS ENUM ('PROFILE_VIEWS_MAPS', 'PROFILE_VIEWS_SEARCH', 'WEBSITE_CLICKS', 'DIRECTION_REQUESTS', 'CALL_CLICKS', 'BOOKING_CLICKS', 'PHOTO_VIEWS', 'SEARCH_KEYWORDS');

-- CreateTable
CREATE TABLE "gbp_locations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "google_location_id" TEXT NOT NULL,
    "google_account_id" TEXT,
    "name" TEXT NOT NULL,
    "store_code" TEXT,
    "phone" TEXT,
    "website_url" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postal_code" TEXT,
    "country_code" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "primary_category" TEXT,
    "additional_categories" JSONB,
    "description" TEXT,
    "hours" JSONB,
    "special_hours" JSONB,
    "attributes" JSONB,
    "photos" JSONB,
    "verification_state" TEXT,
    "completeness_score" INTEGER NOT NULL DEFAULT 0,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gbp_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_insight_snapshots" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "metric_type" "GbpMetricType" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "breakdown" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gbp_insight_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_reviews" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "google_review_id" TEXT NOT NULL,
    "reviewer_name" TEXT,
    "reviewer_photo" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "language" TEXT,
    "reply_text" TEXT,
    "replied_at" TIMESTAMP(3),
    "replied_by" TEXT,
    "sentiment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gbp_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_posts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "type" "GbpPostType" NOT NULL DEFAULT 'UPDATE',
    "status" "GbpPostStatus" NOT NULL DEFAULT 'DRAFT',
    "content" TEXT NOT NULL,
    "media_url" TEXT,
    "cta_type" TEXT,
    "cta_url" TEXT,
    "coupon_code" TEXT,
    "offer_terms" TEXT,
    "event_title" TEXT,
    "event_start" TIMESTAMP(3),
    "event_end" TIMESTAMP(3),
    "scheduled_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "google_post_id" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gbp_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_edit_suggestions" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "current_value" JSONB,
    "suggested_value" JSONB,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "gbp_edit_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_insight_cache" (
    "id" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gbp_insight_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gbp_locations_user_id_idx" ON "gbp_locations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gbp_locations_user_id_google_location_id_key" ON "gbp_locations"("user_id", "google_location_id");

-- CreateIndex
CREATE INDEX "gbp_insight_snapshots_location_id_metric_type_idx" ON "gbp_insight_snapshots"("location_id", "metric_type");

-- CreateIndex
CREATE UNIQUE INDEX "gbp_insight_snapshots_location_id_metric_type_period_start__key" ON "gbp_insight_snapshots"("location_id", "metric_type", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "gbp_reviews_location_id_created_at_idx" ON "gbp_reviews"("location_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "gbp_reviews_location_id_google_review_id_key" ON "gbp_reviews"("location_id", "google_review_id");

-- CreateIndex
CREATE INDEX "gbp_posts_user_id_idx" ON "gbp_posts"("user_id");

-- CreateIndex
CREATE INDEX "gbp_posts_location_id_scheduled_at_idx" ON "gbp_posts"("location_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "gbp_posts_status_scheduled_at_idx" ON "gbp_posts"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "gbp_edit_suggestions_location_id_status_idx" ON "gbp_edit_suggestions"("location_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "gbp_insight_cache_cache_key_key" ON "gbp_insight_cache"("cache_key");

-- AddForeignKey
ALTER TABLE "gbp_locations" ADD CONSTRAINT "gbp_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gbp_insight_snapshots" ADD CONSTRAINT "gbp_insight_snapshots_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "gbp_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gbp_reviews" ADD CONSTRAINT "gbp_reviews_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "gbp_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gbp_posts" ADD CONSTRAINT "gbp_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gbp_posts" ADD CONSTRAINT "gbp_posts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "gbp_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gbp_edit_suggestions" ADD CONSTRAINT "gbp_edit_suggestions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "gbp_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
