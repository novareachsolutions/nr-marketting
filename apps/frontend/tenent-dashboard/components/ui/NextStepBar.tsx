import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NextStepBarProps {
  projectId: string;
  currentStep: number;
}

const STEPS = [
  { num: 1, label: 'Domain Overview', path: 'domain-overview', icon: '🌐' },
  { num: 2, label: 'Site Audit', path: 'audits', icon: '🛠' },
  { num: 3, label: 'Keywords', path: 'keywords', icon: '🔍' },
  { num: 4, label: 'Competitors', path: '', icon: '🎯' },
  { num: 5, label: 'Keyword Gap', path: 'keyword-gap', icon: '🔀' },
  { num: 6, label: 'Backlink Gap', path: 'backlink-gap', icon: '🔗' },
  { num: 7, label: 'Position Tracking', path: 'position-tracking', icon: '📍' },
  { num: 8, label: 'Compare Domains', path: 'compare-domains', icon: '⚖️' },
];

export function NextStepBar({ projectId, currentStep }: NextStepBarProps) {
  const prevStep = STEPS.find((s) => s.num === currentStep - 1);
  const nextStep = STEPS.find((s) => s.num === currentStep + 1);

  const getHref = (step: (typeof STEPS)[0]) => {
    if (!step.path) return `/dashboard/projects/${projectId}#competitors`;
    return `/dashboard/projects/${projectId}/${step.path}`;
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border border-border rounded-lg bg-bg-card">
      <div className="flex-1">
        {prevStep && (
          <Link
            href={getHref(prevStep)}
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors group"
          >
            <ChevronLeft size={16} className="text-text-tertiary group-hover:text-text-primary transition-colors" />
            <span>{prevStep.icon}</span>
            <span>{prevStep.label}</span>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {STEPS.map((s) => (
          <div
            key={s.num}
            className={cn(
              'h-1.5 rounded-full transition-all',
              s.num === currentStep
                ? 'w-6 bg-accent-primary'
                : s.num < currentStep
                ? 'w-1.5 bg-accent-success'
                : 'w-1.5 bg-bg-tertiary'
            )}
          />
        ))}
        <span className="text-xs text-text-tertiary font-medium ml-2">
          {currentStep}/8
        </span>
      </div>

      <div className="flex-1 flex justify-end">
        {nextStep && (
          <Link
            href={getHref(nextStep)}
            className="inline-flex items-center gap-2 text-sm font-medium text-accent-primary hover:text-accent-primary-hover transition-colors group"
          >
            <span>{nextStep.icon}</span>
            <span>{nextStep.label}</span>
            <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}
      </div>
    </div>
  );
}
