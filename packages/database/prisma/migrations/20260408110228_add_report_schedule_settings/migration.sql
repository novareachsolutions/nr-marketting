-- CreateEnum
CREATE TYPE "ReportSchedule" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "last_weekly_report_at" TIMESTAMP(3),
ADD COLUMN     "report_day" INTEGER,
ADD COLUMN     "report_hour" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "report_modules" JSONB,
ADD COLUMN     "report_schedule" "ReportSchedule" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "data" JSONB;
