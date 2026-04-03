import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQueryClient } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProject } from '@/hooks/useProjects';
import { useProjectKeywords, useRemoveKeyword } from '@/hooks/useKeywords';
import { showSuccessToast } from '@repo/shared-frontend';
import styles from './keywords.module.css';

function ProjectKeywordsContent() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading } = useProject(id);
  const [page, setPage] = useState(1);
  const { data: kwData, isLoading: kwLoading } = useProjectKeywords(id, page);
  const removeKeyword = useRemoveKeyword();

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (keywordId: string) => {
    setDeletingId(keywordId);
    try {
      await removeKeyword.mutateAsync(
        `/projects/${id}/keywords/${keywordId}`,
      );
      showSuccessToast('Removed', 'Keyword removed from project');
      queryClient.invalidateQueries({ queryKey: ['project-keywords', id] });
    } catch {
      // handled by global toast
    } finally {
      setDeletingId(null);
    }
  };

  if (projectLoading || !project) {
    return <div className={styles.loading}>Loading project...</div>;
  }

  return (
    <>
      <Head>
        <title>Keywords — {project.name} — NR SEO Platform</title>
      </Head>
      <Sidebar projectId={id} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>
              Saved Keywords
              {kwData && (
                <span className={styles.countBadge}>{kwData.total}</span>
              )}
            </h1>
            <Link href="/dashboard/keywords" className={styles.researchBtn}>
              Keyword Research
            </Link>
          </div>

          {kwLoading ? (
            <div className={styles.loading}>Loading keywords...</div>
          ) : kwData && kwData.keywords.length > 0 ? (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Keyword</th>
                      <th>Target URL</th>
                      <th>Notes</th>
                      <th>Saved</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kwData.keywords.map((kw) => (
                      <tr key={kw.id}>
                        <td className={styles.kwCell}>{kw.keyword}</td>
                        <td className={styles.urlCell}>
                          {kw.targetUrl ? (
                            <a
                              href={kw.targetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.urlLink}
                            >
                              {kw.targetUrl}
                            </a>
                          ) : (
                            <span className={styles.muted}>--</span>
                          )}
                        </td>
                        <td className={styles.notesCell}>
                          {kw.notes || (
                            <span className={styles.muted}>--</span>
                          )}
                        </td>
                        <td className={styles.dateCell}>
                          {new Date(kw.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(kw.id)}
                            disabled={deletingId === kw.id}
                          >
                            {deletingId === kw.id ? '...' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {kwData.totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span className={styles.pageInfo}>
                    Page {kwData.page} of {kwData.totalPages}
                  </span>
                  <button
                    className={styles.pageBtn}
                    disabled={page >= kwData.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>K</div>
              <h3 className={styles.emptyTitle}>No keywords saved yet</h3>
              <p className={styles.emptyDesc}>
                Use the Keyword Research tool to find and save keywords to this
                project.
              </p>
              <Link href="/dashboard/keywords" className={styles.emptyBtn}>
                Research Keywords
              </Link>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default function ProjectKeywordsPage() {
  return (
    <AuthGuard>
      <ProjectKeywordsContent />
    </AuthGuard>
  );
}
