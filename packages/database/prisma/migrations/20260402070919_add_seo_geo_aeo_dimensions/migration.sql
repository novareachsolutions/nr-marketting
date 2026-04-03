-- CreateEnum
CREATE TYPE "IssueDimension" AS ENUM ('SEO', 'GEO', 'AEO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IssueType" ADD VALUE 'MISSING_OG_IMAGE';
ALTER TYPE "IssueType" ADD VALUE 'MISSING_TWITTER_CARD';
ALTER TYPE "IssueType" ADD VALUE 'NON_DESCRIPTIVE_ANCHOR';
ALTER TYPE "IssueType" ADD VALUE 'URL_NOT_CLEAN';
ALTER TYPE "IssueType" ADD VALUE 'NO_CONTENT_DATE';
ALTER TYPE "IssueType" ADD VALUE 'NO_AUTHOR_INFO';
ALTER TYPE "IssueType" ADD VALUE 'NO_ABOUT_PAGE';
ALTER TYPE "IssueType" ADD VALUE 'NO_CONTACT_INFO';
ALTER TYPE "IssueType" ADD VALUE 'WEAK_EEAT_SIGNALS';
ALTER TYPE "IssueType" ADD VALUE 'NO_TRUST_SIGNALS';
ALTER TYPE "IssueType" ADD VALUE 'NO_ORGANIZATION_SCHEMA';
ALTER TYPE "IssueType" ADD VALUE 'MISSING_SOCIAL_PROFILES';
ALTER TYPE "IssueType" ADD VALUE 'LOW_FACTUAL_DENSITY';
ALTER TYPE "IssueType" ADD VALUE 'NO_SOURCE_CITATIONS';
ALTER TYPE "IssueType" ADD VALUE 'WEAK_ENTITY_CLARITY';
ALTER TYPE "IssueType" ADD VALUE 'NO_AUTHOR_SCHEMA';
ALTER TYPE "IssueType" ADD VALUE 'MISSING_SAMEAS_LINKS';
ALTER TYPE "IssueType" ADD VALUE 'AI_CRAWL_BLOCKED';
ALTER TYPE "IssueType" ADD VALUE 'NO_ORIGINAL_DATA';
ALTER TYPE "IssueType" ADD VALUE 'THIN_CONTENT_FOR_AI';
ALTER TYPE "IssueType" ADD VALUE 'UNCLEAR_VALUE_PROPOSITION';
ALTER TYPE "IssueType" ADD VALUE 'NO_CREDENTIALS_VISIBLE';
ALTER TYPE "IssueType" ADD VALUE 'NO_FAQ_SCHEMA';
ALTER TYPE "IssueType" ADD VALUE 'NO_DIRECT_ANSWERS';
ALTER TYPE "IssueType" ADD VALUE 'NO_QUESTION_HEADINGS';
ALTER TYPE "IssueType" ADD VALUE 'NO_HOWTO_SCHEMA';
ALTER TYPE "IssueType" ADD VALUE 'NO_SPEAKABLE_SCHEMA';
ALTER TYPE "IssueType" ADD VALUE 'NO_DEFINITION_PATTERN';
ALTER TYPE "IssueType" ADD VALUE 'NO_LIST_CONTENT';
ALTER TYPE "IssueType" ADD VALUE 'NO_TABLE_CONTENT';
ALTER TYPE "IssueType" ADD VALUE 'MISSING_FAQ_PAGE';
ALTER TYPE "IssueType" ADD VALUE 'LOW_QUESTION_COVERAGE';
ALTER TYPE "IssueType" ADD VALUE 'NOT_CONVERSATIONAL';
ALTER TYPE "IssueType" ADD VALUE 'NO_LOCAL_SIGNALS';
ALTER TYPE "IssueType" ADD VALUE 'NO_LONG_TAIL_QUESTIONS';

-- AlterTable
ALTER TABLE "crawl_issues" ADD COLUMN     "dimension" "IssueDimension" NOT NULL DEFAULT 'SEO';

-- AlterTable
ALTER TABLE "crawl_jobs" ADD COLUMN     "aeo_score" INTEGER,
ADD COLUMN     "geo_score" INTEGER,
ADD COLUMN     "seo_score" INTEGER;

-- AlterTable
ALTER TABLE "crawl_pages" ADD COLUMN     "direct_answer_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "has_author_info" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_author_schema" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_citations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_contact_info" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_content_date" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_definition_pattern" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_faq_schema" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_howto_schema" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_list_content" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_og_image" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_org_schema" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_original_data" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_sameas_links" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_speakable_schema" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_table_content" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_trust_signals" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_twitter_card" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "question_headings_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "schema_types" TEXT,
ADD COLUMN     "social_profile_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "crawl_issues_crawl_page_id_dimension_idx" ON "crawl_issues"("crawl_page_id", "dimension");
