import Link from 'next/link';
import { Check, Lock, ArrowRight, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectCounts {
  crawlJobs?: number;
  projectKeywords?: number;
  trackedKeywords?: number;
}

interface SeoRoadmapProps {
  projectId: string;
  domain: string;
  counts: ProjectCounts;
  competitorCount: number;
  hasDomainOverview?: boolean;
}

interface Step {
  number: number;
  title: string;
  description: string;
  href: string;
  icon: string;
  isComplete: boolean;
  isLocked: boolean;
  lockReason?: string;
}

export function SeoRoadmap({ projectId, domain, counts, competitorCount, hasDomainOverview }: SeoRoadmapProps) {
  const hasAudit = (counts.crawlJobs ?? 0) > 0;
  const hasKeywords = (counts.projectKeywords ?? 0) > 0;
  const hasCompetitors = competitorCount > 0;
  const hasTracked = (counts.trackedKeywords ?? 0) > 0;

  const steps: Step[] = [
    { number: 1, title: 'Analyze Your Domain', description: 'Run Domain Overview to understand your current authority, traffic, and backlinks.', href: `/dashboard/projects/${projectId}/domain-overview`, icon: '🌐', isComplete: !!hasDomainOverview, isLocked: false },
    { number: 2, title: 'Audit Your Site', description: 'Run a Site Audit to find technical SEO, GEO, and AEO issues on your website.', href: `/dashboard/projects/${projectId}/audits`, icon: '🛠', isComplete: hasAudit, isLocked: false },
    { number: 3, title: 'Research Keywords', description: 'Find high-volume, low-difficulty keywords and save them to your project.', href: `/dashboard/projects/${projectId}/keywords`, icon: '🔍', isComplete: hasKeywords, isLocked: false },
    { number: 4, title: 'Add Competitors', description: 'Add competitor domains or let AI suggest them. Required for gap analysis.', href: `/dashboard/projects/${projectId}#competitors`, icon: '🎯', isComplete: hasCompetitors, isLocked: false },
    { number: 5, title: 'Analyze Keyword Gaps', description: "Discover keywords your competitors rank for that you don't — your content priorities.", href: `/dashboard/projects/${projectId}/keyword-gap`, icon: '🔀', isComplete: false, isLocked: !hasCompetitors, lockReason: 'Add competitors first (Step 4)' },
    { number: 6, title: 'Analyze Backlink Gaps', description: 'Find websites linking to competitors but not you — your outreach targets.', href: `/dashboard/projects/${projectId}/backlink-gap`, icon: '🔗', isComplete: false, isLocked: !hasCompetitors, lockReason: 'Add competitors first (Step 4)' },
    { number: 7, title: 'Track Your Rankings', description: 'Add keywords to Position Tracking and monitor daily ranking changes.', href: `/dashboard/projects/${projectId}/position-tracking`, icon: '📍', isComplete: hasTracked, isLocked: false },
    { number: 8, title: 'Compare Against Competitors', description: 'See side-by-side metrics comparison to benchmark your SEO progress.', href: `/dashboard/projects/${projectId}/compare-domains`, icon: '⚖️', isComplete: false, isLocked: !hasCompetitors, lockReason: 'Add competitors first (Step 4)' },
  ];

  const completedCount = steps.filter((s) => s.isComplete).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="border border-border rounded-lg bg-bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-text-primary">SEO Roadmap</h2>
          <span className="text-xs text-text-tertiary">{domain}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-text-secondary">
            {completedCount} of {steps.length} complete
          </span>
          <div className="w-24 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-primary rounded-full transition-all duration-slow"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-border">
        {steps.map((step) => (
          <div
            key={step.number}
            className={cn(
              'flex items-center justify-between px-5 py-3.5 transition-colors',
              step.isComplete && 'bg-accent-success-light/30',
              step.isLocked && 'opacity-50'
            )}
          >
            <div className="flex items-center gap-3.5">
              {/* Status indicator */}
              <div
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  step.isComplete && 'bg-accent-success text-white',
                  step.isLocked && 'bg-bg-tertiary text-text-tertiary',
                  !step.isComplete && !step.isLocked && 'bg-accent-primary-light text-accent-primary'
                )}
              >
                {step.isComplete ? (
                  <Check size={14} />
                ) : step.isLocked ? (
                  <Lock size={12} />
                ) : (
                  step.number
                )}
              </div>

              {/* Content */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">{step.icon}</span>
                  <span className="text-sm font-medium text-text-primary">
                    {step.title}
                  </span>
                </div>
                <p className="text-xs text-text-tertiary mt-0.5 ml-7">
                  {step.isLocked ? step.lockReason : step.description}
                </p>
              </div>
            </div>

            {/* Action */}
            <div className="flex-shrink-0 ml-4">
              {step.isLocked ? (
                <span className="text-xs text-text-tertiary font-medium px-3 py-1.5 rounded-md bg-bg-tertiary">
                  Locked
                </span>
              ) : step.isComplete ? (
                <Link
                  href={step.href}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-md border border-border hover:bg-bg-hover transition-colors"
                >
                  <Eye size={12} />
                  View
                </Link>
              ) : (
                <Link
                  href={step.href}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-accent-primary hover:bg-accent-primary-hover px-3 py-1.5 rounded-md transition-colors"
                >
                  Go
                  <ArrowRight size={12} />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
