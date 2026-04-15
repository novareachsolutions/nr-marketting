import { useGet, usePost, usePatch, useDelete } from '@repo/shared-frontend';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@repo/shared-frontend';
import type {
  WritingDocument,
  WritingDocumentListResponse,
  RephraseResponse,
  ComposeResponse,
  AskAiResponse,
  OriginalityResponse,
  ToneResponse,
  SeoAnalysisResponse,
  RephraseMode,
} from '@/types/writing-assistant';

// ─── Document CRUD ───────────────────────────────────────

export function useWritingDocuments(projectId?: string) {
  const params = projectId ? `?projectId=${projectId}` : '';
  return useGet<WritingDocumentListResponse>(
    `/writing/documents${params}`,
    ['writing-documents', projectId || ''],
  );
}

export function useWritingDocument(id: string | null) {
  return useGet<WritingDocument>(
    `/writing/documents/${id}`,
    ['writing-document', id || ''],
    { enabled: !!id },
  );
}

export function useCreateDocument() {
  return usePost<WritingDocument>(['writing-documents']);
}

export function useUpdateDocument() {
  return usePatch<WritingDocument>(['writing-documents']);
}

export function useDeleteDocument() {
  return useDelete(['writing-documents']);
}

// ─── AI Tools ────────────────────────────────────────────

export function useRephrase() {
  return useMutation<RephraseResponse, Error, { text: string; mode: RephraseMode; context?: string }>({
    mutationFn: async (data) => {
      const res = await apiClient.post('/writing/rephrase', data);
      return res.data.data;
    },
  });
}

export function useCompose() {
  return useMutation<ComposeResponse, Error, {
    topic: string;
    keywords?: string[];
    tone?: string;
    contentType?: string;
    length?: string;
  }>({
    mutationFn: async (data) => {
      const res = await apiClient.post('/writing/compose', data);
      return res.data.data;
    },
  });
}

export function useAskAi() {
  return useMutation<AskAiResponse, Error, {
    question: string;
    topic?: string;
    currentContent?: string;
  }>({
    mutationFn: async (data) => {
      const res = await apiClient.post('/writing/ask-ai', data);
      return res.data.data;
    },
  });
}

export function useCheckOriginality() {
  return useMutation<OriginalityResponse, Error, { text: string }>({
    mutationFn: async (data) => {
      const res = await apiClient.post('/writing/check-originality', data);
      return res.data.data;
    },
  });
}

export function useCheckTone() {
  return useMutation<ToneResponse, Error, { text: string; targetTone: string }>({
    mutationFn: async (data) => {
      const res = await apiClient.post('/writing/check-tone', data);
      return res.data.data;
    },
  });
}

// ─── SEO Analysis ────────────────────────────────────────

export function useSeoAnalysis() {
  return useMutation<SeoAnalysisResponse, Error, { keywords: string[]; country?: string }>({
    mutationFn: async (data) => {
      const res = await apiClient.post('/writing/seo-analysis', data);
      return res.data.data;
    },
  });
}
