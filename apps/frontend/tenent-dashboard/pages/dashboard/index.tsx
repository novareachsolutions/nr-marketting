import { useState } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { useProjects, useDeleteProject } from '@/hooks/useProjects';
import { showSuccessToast } from '@repo/shared-frontend';
import { useQueryClient } from '@tanstack/react-query';
import styles from './index.module.css';

function DashboardContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: projects, isLoading } = useProjects();
  const deleteProject = useDeleteProject();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project and all its data? This cannot be undone.')) return;
    try {
      await deleteProject.mutateAsync(`/projects/${id}`);
      showSuccessToast('Deleted', 'Project removed successfully');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch {
      // error handled by global toast
    }
  };

  const planLimits: Record<string, number> = { FREE: 1, PRO: 5, AGENCY: 25 };
  const maxProjects = planLimits[user?.plan || 'FREE'] || 1;

  return (
    <>
      <Head>
        <title>Dashboard — NR SEO Platform</title>
      </Head>
      <Sidebar />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.greeting}>
                Welcome{user?.name ? `, ${user.name}` : ''}
              </h1>
              <p className={styles.subtitle}>
                {projects?.length
                  ? `You have ${projects.length} of ${maxProjects} project(s)`
                  : 'Get started by creating your first project'}
              </p>
            </div>
            <button
              className={styles.createBtn}
              onClick={() => setShowCreateModal(true)}
              disabled={(projects?.length ?? 0) >= maxProjects}
              title={
                (projects?.length ?? 0) >= maxProjects
                  ? `Your ${user?.plan} plan allows ${maxProjects} project(s)`
                  : 'Create a new project'
              }
            >
              + New Project
            </button>
          </div>

          {isLoading ? (
            <div className={styles.loading}>Loading projects...</div>
          ) : projects && projects.length > 0 ? (
            <div className={styles.projectsGrid}>
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onDelete={handleDelete} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🚀</div>
              <h3 className={styles.emptyTitle}>Create your first project</h3>
              <p className={styles.emptyDesc}>
                Add a website to start tracking rankings, auditing SEO issues,
                and getting AI-powered insights.
              </p>
              <button
                className={styles.emptyBtn}
                onClick={() => setShowCreateModal(true)}
              >
                + New Project
              </button>
            </div>
          )}
        </main>

        <CreateProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={() =>
            queryClient.invalidateQueries({ queryKey: ['projects'] })
          }
        />
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
