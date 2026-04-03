-- CreateEnum
CREATE TYPE "CrawlSchedule" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IssueType" ADD VALUE 'BROKEN_EXTERNAL_LINK';
ALTER TYPE "IssueType" ADD VALUE 'MIXED_CONTENT';
ALTER TYPE "IssueType" ADD VALUE 'MISSING_VIEWPORT';
ALTER TYPE "IssueType" ADD VALUE 'MISSING_LANG';
ALTER TYPE "IssueType" ADD VALUE 'MISSING_OG_TAGS';
ALTER TYPE "IssueType" ADD VALUE 'MISSING_STRUCTURED_DATA';
ALTER TYPE "IssueType" ADD VALUE 'LARGE_PAGE_SIZE';
ALTER TYPE "IssueType" ADD VALUE 'TOO_MANY_LINKS';
ALTER TYPE "IssueType" ADD VALUE 'ORPHAN_PAGE';
ALTER TYPE "IssueType" ADD VALUE 'LOW_INTERNAL_LINKS';
ALTER TYPE "IssueType" ADD VALUE 'LOW_EXTERNAL_LINKS';
ALTER TYPE "IssueType" ADD VALUE 'UNCOMPRESSED_IMAGES';

-- AlterTable
ALTER TABLE "crawl_pages" ADD COLUMN     "has_lang_attr" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "has_og_tags" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "has_structured_data" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "has_viewport" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "html_size" INTEGER,
ADD COLUMN     "redirect_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "crawl_schedule" "CrawlSchedule" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "last_scheduled_crawl_at" TIMESTAMP(3);
