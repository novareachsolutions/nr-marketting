import { useGet, usePost, useDelete } from '@repo/shared-frontend';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@repo/shared-frontend';
import type {
  SeoContentBrief,
  SeoContentBriefListResponse,
  GenerateBriefInput,
  SendToWriterResponse,
} from '@/types/seo-content-template';

// ─── List ─────────────────────────────────────────────────

export function useContentBriefs(projectId?: string) {
  const params = projectId ? `?projectId=${projectId}` : '';
  return useGet<SeoContentBriefListResponse>(
    `/seo-content-template${params}`,
    ['seo-content-template', projectId || ''],
  );
}

// ─── Get one ──────────────────────────────────────────────

export function useContentBrief(id: string | null) {
  return useGet<SeoContentBrief>(
    `/seo-content-template/${id}`,
    ['seo-content-template', id || ''],
    { enabled: !!id },
  );
}

// ─── Generate ─────────────────────────────────────────────

export function useGenerateBrief() {
  return useMutation<SeoContentBrief, Error, GenerateBriefInput>({
    mutationFn: async (data) => {
      const res = await apiClient.post('/seo-content-template/generate', data);
      return res.data.data;
    },
  });
}

// ─── Delete ───────────────────────────────────────────────

export function useDeleteBrief() {
  return useDelete(['seo-content-template']);
}

// ─── Send to Writing Assistant ────────────────────────────

export function useSendBriefToWriter() {
  return useMutation<SendToWriterResponse, Error, string>({
    mutationFn: async (briefId) => {
      const res = await apiClient.post(
        `/seo-content-template/${briefId}/send-to-writer`,
        {},
      );
      return res.data.data;
    },
  });
}

// ─── Export .doc URL helper ───────────────────────────────

export function getBriefExportUrl(briefId: string): string {
  return `/seo-content-template/${briefId}/export`;
}
