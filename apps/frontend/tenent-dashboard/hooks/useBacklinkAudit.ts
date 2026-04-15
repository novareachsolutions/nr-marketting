import { useGet, usePost, usePatch, useDelete, apiClient } from '@repo/shared-frontend';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  BacklinkAuditJob,
  BacklinkAuditListItem,
  BacklinkAuditLink,
  BacklinkAuditLinkStatus,
} from '@/types/backlink-audit';

// ─── List user's audits ────────────────────────────────
export function useBacklinkAuditList() {
  return useGet<BacklinkAuditListItem[]>(
    `/backlink-audit`,
    ['backlink-audit', 'list'],
  );
}

// ─── Get one audit by id ───────────────────────────────
export function useBacklinkAudit(id: string | null) {
  return useGet<BacklinkAuditJob>(
    `/backlink-audit/${id}`,
    ['backlink-audit', id || ''],
    { enabled: !!id },
  );
}

// ─── Run a new audit ───────────────────────────────────
export function useRunBacklinkAudit() {
  return usePost<BacklinkAuditJob>(['backlink-audit']);
}

// ─── Update single link status ─────────────────────────
export function useUpdateAuditLinkStatus() {
  return usePatch<BacklinkAuditLink>(['backlink-audit']);
}

// ─── Bulk update statuses ──────────────────────────────
export function useBulkUpdateAuditLinks() {
  return usePatch<{ updated: number }>(['backlink-audit']);
}

// ─── Delete an audit ───────────────────────────────────
export function useDeleteBacklinkAudit() {
  return useDelete(['backlink-audit']);
}

// ─── Download disavow.txt ──────────────────────────────
export function useDownloadDisavow() {
  return useMutation<void, Error, { jobId: string; domain: string }>({
    mutationFn: async ({ jobId, domain }) => {
      const res = await apiClient.get(`/backlink-audit/${jobId}/disavow.txt`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `disavow-${domain}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
  });
}

// Helper to trigger refetch after status updates
export function useInvalidateBacklinkAudit() {
  const qc = useQueryClient();
  return (id: string) => {
    qc.invalidateQueries({ queryKey: ['backlink-audit', id] });
    qc.invalidateQueries({ queryKey: ['backlink-audit', 'list'] });
  };
}
