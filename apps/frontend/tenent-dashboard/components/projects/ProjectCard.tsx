import { useRouter } from 'next/router';
import type { Project } from '@/types/project';
import { Badge } from '../ui/Badge';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  project: Project;
  onDelete: (id: string) => void;
}

const SOURCE_BADGE: Record<string, { variant: 'default' | 'wordpress' | 'github'; label: string }> = {
  MANUAL: { variant: 'default', label: 'Manual' },
  WORDPRESS: { variant: 'wordpress', label: 'WordPress' },
  GITHUB: { variant: 'github', label: 'GitHub' },
};

export function ProjectCard({ project, onDelete }: Props) {
  const router = useRouter();
  const badge = SOURCE_BADGE[project.sourceType] || SOURCE_BADGE.MANUAL;

  return (
    <div
      className={cn(
        'bg-bg-card border border-border rounded-lg p-5 cursor-pointer',
        'flex flex-col gap-3.5 transition-all duration-fast',
        'hover:border-border-focus hover:shadow-md hover:-translate-y-0.5',
        !project.isActive && 'opacity-50'
      )}
      onClick={() => router.push(`/dashboard/projects/${project.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="h-10 w-10 rounded-md bg-accent-primary-light text-accent-primary flex items-center justify-center text-lg font-bold flex-shrink-0">
          {project.domain.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-text-primary truncate">
            {project.name}
          </div>
          <div className="text-[13px] text-text-secondary mt-0.5">{project.domain}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {!project.isActive && (
            <Badge variant="warning" size="sm">Paused</Badge>
          )}
          <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
          <button
            className={cn(
              'h-[30px] w-[30px] rounded-sm border border-border bg-bg-card',
              'flex items-center justify-center text-text-tertiary',
              'hover:bg-accent-danger-light hover:text-accent-danger hover:border-accent-danger',
              'transition-all duration-fast cursor-pointer'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(project.id);
            }}
            title="Delete project"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="flex gap-4 pt-3.5 border-t border-border">
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-bold text-text-primary">
            {project._count?.trackedKeywords ?? 0}
          </span>
          <span className="text-[11px] text-text-tertiary uppercase tracking-wide">Keywords</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-bold text-text-primary">
            {project._count?.competitors ?? 0}
          </span>
          <span className="text-[11px] text-text-tertiary uppercase tracking-wide">Competitors</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-bold text-text-primary">
            {project._count?.crawlJobs ?? 0}
          </span>
          <span className="text-[11px] text-text-tertiary uppercase tracking-wide">Audits</span>
        </div>
      </div>
    </div>
  );
}
