import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

@Injectable()
export class ReportSchedulerService {
  private readonly logger = new Logger(ReportSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleScheduledReports() {
    this.logger.log('Checking for scheduled reports...');

    const now = new Date();

    const projects = await this.prisma.project.findMany({
      where: {
        isActive: true,
        reportSchedule: { not: 'NONE' },
      },
      include: {
        user: true,
      },
    });

    let triggered = 0;

    for (const project of projects) {
      try {
        if (!this.isDue(project, now)) continue;

        // Check if there's already a pending/generating report
        const activeReport = await this.prisma.report.findFirst({
          where: {
            projectId: project.id,
            status: { in: ['PENDING', 'GENERATING'] },
          },
        });

        if (activeReport) {
          this.logger.log(
            `Skipping report for project ${project.id} — report already in progress`,
          );
          continue;
        }

        // Update timestamp first to prevent double-runs
        await this.prisma.project.update({
          where: { id: project.id },
          data: { lastWeeklyReportAt: now },
        });

        const dateFrom = new Date(now);
        dateFrom.setDate(dateFrom.getDate() - this.getIntervalDays(project.reportSchedule));

        // Create and execute report
        const report = await this.prisma.report.create({
          data: {
            projectId: project.id,
            title: `${project.reportSchedule} SEO Report - ${this.formatDate(dateFrom)} to ${this.formatDate(now)}`,
            type: project.reportSchedule === 'MONTHLY' ? 'MONTHLY' : 'WEEKLY',
            dateFrom,
            dateTo: now,
            status: 'PENDING',
          },
        });

        // Execute in background with delay between projects
        const delay = triggered * 5000; // 5s gap between projects
        setTimeout(() => {
          this.reportsService
            .executeReportGeneration(report.id, project)
            .catch((err) => {
              this.logger.error(
                `Scheduled report failed for project ${project.id}: ${err}`,
              );
            });
        }, delay);

        triggered++;
        this.logger.log(
          `Triggered scheduled report ${report.id} for ${project.domain} (${project.reportSchedule})`,
        );
      } catch (err) {
        this.logger.error(
          `Error processing scheduled report for project ${project.id}: ${err}`,
        );
      }
    }

    if (triggered > 0) {
      this.logger.log(`Triggered ${triggered} scheduled reports`);
    }
  }

  private isDue(project: any, now: Date): boolean {
    const { reportSchedule, reportDay, reportHour, lastWeeklyReportAt } = project;

    // Check if the current hour matches the configured hour
    if (now.getUTCHours() !== (reportHour ?? 2)) return false;

    // For WEEKLY, check if today is the correct day
    if (reportSchedule === 'WEEKLY' && reportDay !== null && reportDay !== undefined) {
      if (now.getUTCDay() !== reportDay) return false;
    }

    // Check if enough time has passed since last report
    if (!lastWeeklyReportAt) return true;

    const hoursSinceLast =
      (now.getTime() - lastWeeklyReportAt.getTime()) / (1000 * 60 * 60);

    switch (reportSchedule) {
      case 'DAILY':
        return hoursSinceLast >= 23; // slight buffer
      case 'WEEKLY':
        return hoursSinceLast >= 167; // 7 days minus 1h buffer
      case 'MONTHLY':
        return hoursSinceLast >= 719; // 30 days minus 1h buffer
      default:
        return false;
    }
  }

  private getIntervalDays(schedule: string): number {
    switch (schedule) {
      case 'DAILY':
        return 1;
      case 'WEEKLY':
        return 7;
      case 'MONTHLY':
        return 30;
      default:
        return 7;
    }
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
