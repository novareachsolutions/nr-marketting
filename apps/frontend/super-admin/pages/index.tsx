import { useState, useMemo } from 'react';
import Head from 'next/head';
import { AuthGuard } from '@/components/AuthGuard';
import { DashboardShell } from '@/components/DashboardShell';
import {
  useAdminUsers,
  useApproveUser,
  useRejectUser,
  ApprovalStatus,
  AdminUserRow,
} from '@/hooks/useAdminUsers';
import styles from '@/styles/Dashboard.module.css';

const TABS: Array<{ key: ApprovalStatus | 'ALL'; label: string }> = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'ALL', label: 'All' },
];

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const map: Record<ApprovalStatus, string> = {
    PENDING: styles.badgePending,
    APPROVED: styles.badgeApproved,
    REJECTED: styles.badgeRejected,
  };
  const labels: Record<ApprovalStatus, string> = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  };
  return (
    <span className={`${styles.badge} ${map[status]}`}>{labels[status]}</span>
  );
}

function UsersDashboard() {
  const [status, setStatus] = useState<ApprovalStatus | 'ALL'>('PENDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [rejectTarget, setRejectTarget] = useState<AdminUserRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState('');

  const { data, isLoading, isFetching } = useAdminUsers({
    status,
    search,
    page,
    pageSize,
  });
  const approveMutation = useApproveUser();
  const rejectMutation = useRejectUser();

  const summary = data?.summary ?? { pending: 0, approved: 0, rejected: 0 };
  const users = data?.users ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;
  const total = data?.pagination.total ?? 0;

  const onApprove = async (user: AdminUserRow) => {
    setActionError('');
    try {
      await approveMutation.mutateAsync(user.id);
    } catch (err: any) {
      setActionError(
        err?.response?.data?.message || err?.message || 'Failed to approve',
      );
    }
  };

  const onConfirmReject = async () => {
    if (!rejectTarget) return;
    setActionError('');
    try {
      await rejectMutation.mutateAsync({
        userId: rejectTarget.id,
        reason: rejectReason.trim() || undefined,
      });
      setRejectTarget(null);
      setRejectReason('');
    } catch (err: any) {
      setActionError(
        err?.response?.data?.message || err?.message || 'Failed to reject',
      );
    }
  };

  const handleTabChange = (next: ApprovalStatus | 'ALL') => {
    setStatus(next);
    setPage(1);
  };

  const tabKey = useMemo(() => status, [status]);

  return (
    <DashboardShell>
      <Head>
        <title>User approvals — NR Super Admin</title>
      </Head>

      <div className={styles.header}>
        <h1 className={styles.title}>User approvals</h1>
        <p className={styles.subtitle}>
          Review newly registered accounts and approve them so they can sign in
          to the platform.
        </p>
      </div>

      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pending</div>
          <div className={styles.statValue}>{summary.pending}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Approved</div>
          <div className={styles.statValue}>{summary.approved}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Rejected</div>
          <div className={styles.statValue}>{summary.rejected}</div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tab} ${tabKey === tab.key ? styles.tabActive : ''}`}
              onClick={() => handleTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          className={styles.search}
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {actionError && (
        <div
          style={{
            background: 'var(--danger-soft)',
            color: 'var(--danger)',
            padding: '10px 14px',
            borderRadius: 6,
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          {actionError}
        </div>
      )}

      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Registered</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  {status === 'PENDING'
                    ? 'No users awaiting approval.'
                    : 'No users found.'}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className={styles.userCell}>
                      <span className={styles.userName}>
                        {user.name || '—'}
                      </span>
                      <span className={styles.userEmail}>{user.email}</span>
                    </div>
                  </td>
                  <td>{user.plan}</td>
                  <td>
                    <StatusBadge status={user.approvalStatus} />
                    {user.approvalStatus === 'REJECTED' &&
                      user.rejectionReason && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--text-tertiary)',
                            marginTop: 4,
                          }}
                        >
                          {user.rejectionReason}
                        </div>
                      )}
                  </td>
                  <td style={{ color: 'var(--text-tertiary)' }}>
                    {formatDate(user.createdAt)}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {user.approvalStatus !== 'APPROVED' && (
                        <button
                          className={`${styles.btn} ${styles.btnApprove}`}
                          onClick={() => onApprove(user)}
                          disabled={approveMutation.isPending}
                        >
                          {approveMutation.isPending &&
                          approveMutation.variables === user.id
                            ? 'Approving...'
                            : 'Approve'}
                        </button>
                      )}
                      {user.approvalStatus !== 'REJECTED' &&
                        user.role !== 'SUPER_ADMIN' && (
                          <button
                            className={`${styles.btn} ${styles.btnReject}`}
                            onClick={() => {
                              setRejectTarget(user);
                              setRejectReason('');
                              setActionError('');
                            }}
                          >
                            Reject
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className={styles.pagination}>
          <span>
            {total > 0
              ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(
                  page * pageSize,
                  total,
                )} of ${total}`
              : '0 results'}
            {isFetching && ' • refreshing...'}
          </span>
          <div className={styles.pageBtns}>
            <button
              className={styles.pageBtn}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              className={styles.pageBtn}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {rejectTarget && (
        <div
          className={styles.modalBackdrop}
          onClick={() => {
            if (!rejectMutation.isPending) setRejectTarget(null);
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Reject user</div>
            <div className={styles.modalDesc}>
              Reject <strong>{rejectTarget.email}</strong>? They will not be
              able to sign in. You can optionally include a reason.
            </div>
            <textarea
              className={styles.textarea}
              placeholder="Optional reason (visible internally)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={500}
            />
            <div className={styles.modalActions}>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setRejectTarget(null)}
                disabled={rejectMutation.isPending}
              >
                Cancel
              </button>
              <button
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={onConfirmReject}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function HomePage() {
  return (
    <AuthGuard>
      <UsersDashboard />
    </AuthGuard>
  );
}
