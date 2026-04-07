import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/GuideModal';
import { SuggestCompetitors } from '@/components/ui/SuggestCompetitors';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import {
  useProject,
  useCompetitors,
  useAddCompetitor,
  useRemoveCompetitor,
  useDeleteProject,
} from '@/hooks/useProjects';
import { showSuccessToast } from '@repo/shared-frontend';
import styles from './[id].module.css';

function ProjectDetailContent() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useProject(id);
  const { data: competitors } = useCompetitors(id);
  const addCompetitor = useAddCompetitor();
  const removeCompetitor = useRemoveCompetitor();
  const deleteProject = useDeleteProject();

  const [newDomain, setNewDomain] = useState('');
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  const [showGuide, setShowGuide] = useState(false);


  const handleAddCompetitor = async (e: FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!newDomain.trim()) return;

    try {
      await addCompetitor.mutateAsync({
        url: `/projects/${id}/competitors`,
        body: { domain: newDomain.trim(), name: newName.trim() || undefined },
      });
      showSuccessToast('Added', `Competitor ${newDomain.trim()} added`);
      setNewDomain('');
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['competitors', id] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    } catch (err: any) {
      setAddError(err?.message || 'Failed to add competitor');
    }
  };

  const handleRemoveCompetitor = async (competitorId: string) => {
    try {
      await removeCompetitor.mutateAsync(
        `/projects/${id}/competitors/${competitorId}`,
      );
      showSuccessToast('Removed', 'Competitor removed');
      queryClient.invalidateQueries({ queryKey: ['competitors', id] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    } catch {
      // handled by global toast
    }
  };

  const handleDeleteProject = async () => {
    if (
      !confirm(
        'Delete this project and ALL related data (keywords, audits, reports)? This cannot be undone.',
      )
    )
      return;

    try {
      await deleteProject.mutateAsync(`/projects/${id}`);
      showSuccessToast('Deleted', 'Project removed');
      router.push('/dashboard');
    } catch {
      // handled by global toast
    }
  };

  if (isLoading || !project) {
    return <div className={styles.loading}>Loading project...</div>;
  }

  return (
    <>
      <Head>
        <title>{project.name} — NR SEO Platform</title>
      </Head>
      <Sidebar projectId={id} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{project.name}</h1>
              <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="How to use this tool">?</button>
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{project.domain}</span>
          </div>

          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Project Overview — Guide">
            <h4>What is the Project Overview?</h4>
            <p>This is your project's home page. It shows a summary of all SEO data for your domain — keywords saved, audits run, competitors tracked, and reports generated.</p>

            <h4>What you can do here</h4>
            <ul>
              <li><strong>View stats</strong> — Quick counts of keywords, tracked keywords, audits, competitors, and reports.</li>
              <li><strong>Manage competitors</strong> — Add competitor domains to compare against in keyword gap and other tools.</li>
              <li><strong>View settings</strong> — See project domain, source type, timezone, and status.</li>
              <li><strong>Navigate</strong> — Use the sidebar to jump to Keywords, Site Audit, or Position Tracking.</li>
            </ul>

            <h4>Pro tips</h4>
            <ul>
              <li>Add 2-3 competitors to unlock keyword gap analysis within your project.</li>
              <li>Use the sidebar navigation to access all project-specific tools.</li>
            </ul>
          </GuideModal>

          {/* Stats */}
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Keywords</div>
              <div className={styles.statValue}>
                {project._count?.projectKeywords ?? 0}
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Tracked</div>
              <div className={styles.statValue}>
                {project._count?.trackedKeywords ?? 0}
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Audits</div>
              <div className={styles.statValue}>
                {project._count?.crawlJobs ?? 0}
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Competitors</div>
              <div className={styles.statValue}>
                {competitors?.length ?? 0}
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Reports</div>
              <div className={styles.statValue}>
                {project._count?.reports ?? 0}
              </div>
            </div>
          </div>

          {/* ─── Competitors Section ─── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionTitle}>Competitors</span>
                <span className={styles.sectionCount}>
                  {competitors?.length ?? 0}
                </span>
              </div>
            </div>

            {competitors && competitors.length > 0 ? (
              <div className={styles.competitorList}>
                {competitors.map((c) => (
                  <div key={c.id} className={styles.competitorRow}>
                    <div>
                      <span className={styles.competitorDomain}>
                        {c.domain}
                      </span>
                      {c.name && (
                        <span className={styles.competitorName}>{c.name}</span>
                      )}
                    </div>
                    <button
                      className={styles.removeBtn}
                      onClick={() => handleRemoveCompetitor(c.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptySection}>
                No competitors added yet
              </div>
            )}

            <div style={{ padding: '0 20px 16px' }}>
              <SuggestCompetitors projectId={id} domain={project.domain} />
            </div>

            <form className={styles.addForm} onSubmit={handleAddCompetitor}>
                <input
                  className={styles.addInput}
                  type="text"
                  placeholder="competitor.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                />
                <input
                  className={styles.addInput}
                  type="text"
                  placeholder="Label (optional)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ maxWidth: 160 }}
                />
                <button
                  type="submit"
                  className={styles.addSubmitBtn}
                  disabled={addCompetitor.isPending || !newDomain.trim()}
                >
                  {addCompetitor.isPending ? 'Adding...' : 'Add'}
                </button>
              </form>
            {addError && (
              <div
                style={{
                  padding: '8px 20px 14px',
                  fontSize: 12,
                  color: 'var(--accent-danger)',
                }}
              >
                {addError}
              </div>
            )}
          </div>

          {/* ─── Project Settings ─── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Project Settings</span>
            </div>
            <div className={styles.settingsGrid}>
              <div className={styles.settingItem}>
                <span className={styles.settingLabel}>Domain</span>
                <span className={styles.settingValue}>{project.domain}</span>
              </div>
              <div className={styles.settingItem}>
                <span className={styles.settingLabel}>Source Type</span>
                <span className={styles.settingValue}>
                  {project.sourceType}
                </span>
              </div>
              <div className={styles.settingItem}>
                <span className={styles.settingLabel}>Timezone</span>
                <span className={styles.settingValue}>{project.timezone}</span>
              </div>
              <div className={styles.settingItem}>
                <span className={styles.settingLabel}>Status</span>
                <span className={styles.settingValue}>
                  {project.isActive ? 'Active' : 'Paused'}
                </span>
              </div>
              <div className={styles.settingItem}>
                <span className={styles.settingLabel}>Created</span>
                <span className={styles.settingValue}>
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* ─── Danger Zone ─── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Danger Zone</span>
            </div>
            <div className={styles.dangerZone}>
              <span className={styles.dangerText}>
                Permanently delete this project and all its data
              </span>
              <button
                className={styles.dangerBtn}
                onClick={handleDeleteProject}
              >
                Delete Project
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default function ProjectDetailPage() {
  return (
    <AuthGuard>
      <ProjectDetailContent />
    </AuthGuard>
  );
}
