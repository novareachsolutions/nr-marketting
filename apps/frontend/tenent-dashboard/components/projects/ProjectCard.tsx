import { useRouter } from 'next/router';
import type { Project } from '@/types/project';
import styles from './ProjectCard.module.css';

interface Props {
  project: Project;
  onDelete: (id: string) => void;
}

const SOURCE_BADGE: Record<string, { className: string; label: string }> = {
  MANUAL: { className: styles.badgeManual, label: 'Manual' },
  WORDPRESS: { className: styles.badgeWordpress, label: 'WordPress' },
  GITHUB: { className: styles.badgeGithub, label: 'GitHub' },
};

export function ProjectCard({ project, onDelete }: Props) {
  const router = useRouter();
  const badge = SOURCE_BADGE[project.sourceType] || SOURCE_BADGE.MANUAL;

  return (
    <div
      className={`${styles.card} ${!project.isActive ? styles.inactive : ''}`}
      onClick={() => router.push(`/dashboard/projects/${project.id}`)}
    >
      <div className={styles.cardHeader}>
        <div className={styles.domainIcon}>
          {project.domain.charAt(0).toUpperCase()}
        </div>
        <div className={styles.info}>
          <div className={styles.name}>{project.name}</div>
          <div className={styles.domain}>{project.domain}</div>
        </div>
        <div className={styles.actions}>
          {!project.isActive && (
            <span className={styles.inactiveBadge}>Paused</span>
          )}
          <span className={badge.className}>{badge.label}</span>
          <button
            className={styles.deleteBtn}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(project.id);
            }}
            title="Delete project"
          >
            🗑
          </button>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {project._count?.trackedKeywords ?? 0}
          </span>
          <span className={styles.statLabel}>Keywords</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {project._count?.competitors ?? 0}
          </span>
          <span className={styles.statLabel}>Competitors</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {project._count?.crawlJobs ?? 0}
          </span>
          <span className={styles.statLabel}>Audits</span>
        </div>
      </div>
    </div>
  );
}
