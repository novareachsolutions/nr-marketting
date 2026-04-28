import { useGet } from '@repo/shared-frontend';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@repo/shared-frontend';
import type {
  GbpConnectionStatus,
  GbpLocation,
  GbpInsights,
  GbpReviewsResponse,
  GbpReview,
  GbpPostsResponse,
  GbpPost,
  GbpEditSuggestion,
  GbpAiPostDraft,
  GbpPostType,
} from '@/types/gbp-optimization';

// ─── Connection / Status ────────────────────────────────

export function useGbpStatus() {
  return useGet<GbpConnectionStatus>('/gbp/status', ['gbp-status']);
}

// ─── Locations ──────────────────────────────────────────

export function useGbpLocations() {
  return useGet<GbpLocation[]>('/gbp/locations', ['gbp-locations']);
}

export function useGbpLocation(id: string | null) {
  return useGet<GbpLocation>(
    `/gbp/locations/${id}`,
    ['gbp-location', id || ''],
    { enabled: !!id },
  );
}

export function useSyncGbpLocations() {
  const qc = useQueryClient();
  return useMutation<{ synced: number; locations: GbpLocation[] }, Error, void>(
    {
      mutationFn: async () => {
        const res = await apiClient.post('/gbp/locations/sync');
        return res.data.data;
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['gbp-locations'] });
        qc.invalidateQueries({ queryKey: ['gbp-status'] });
      },
    },
  );
}

export function useUpdateGbpLocation() {
  const qc = useQueryClient();
  return useMutation<
    GbpLocation,
    Error,
    { id: string; patch: Partial<GbpLocation> }
  >({
    mutationFn: async ({ id, patch }) => {
      const res = await apiClient.patch(`/gbp/locations/${id}`, patch);
      return res.data.data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['gbp-locations'] });
      qc.invalidateQueries({ queryKey: ['gbp-location', vars.id] });
    },
  });
}

// ─── Insights ───────────────────────────────────────────

export function useGbpInsights(locationId: string | null, months = 12) {
  return useGet<GbpInsights>(
    `/gbp/locations/${locationId}/insights?months=${months}`,
    ['gbp-insights', locationId || '', String(months)],
    { enabled: !!locationId },
  );
}

// ─── Reviews ────────────────────────────────────────────

export function useGbpReviews(
  locationId: string | null,
  page = 1,
  limit = 20,
) {
  return useGet<GbpReviewsResponse>(
    `/gbp/locations/${locationId}/reviews?page=${page}&limit=${limit}`,
    ['gbp-reviews', locationId || '', String(page), String(limit)],
    { enabled: !!locationId },
  );
}

export function useReplyToGbpReview() {
  const qc = useQueryClient();
  return useMutation<GbpReview, Error, { id: string; reply: string }>({
    mutationFn: async ({ id, reply }) => {
      const res = await apiClient.post(`/gbp/reviews/${id}/reply`, { reply });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gbp-reviews'] });
    },
  });
}

export function useGbpAiReview() {
  return useMutation<{ suggestion: string }, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const res = await apiClient.post(`/gbp/reviews/${id}/ai-reply`, {});
      return res.data.data;
    },
  });
}

// ─── Posts ──────────────────────────────────────────────

export function useGbpPosts(
  locationId: string | null,
  page = 1,
  limit = 20,
) {
  return useGet<GbpPostsResponse>(
    `/gbp/locations/${locationId}/posts?page=${page}&limit=${limit}`,
    ['gbp-posts', locationId || '', String(page), String(limit)],
    { enabled: !!locationId },
  );
}

export function useCreateGbpPost() {
  const qc = useQueryClient();
  return useMutation<
    GbpPost,
    Error,
    {
      locationId: string;
      type: GbpPostType;
      content: string;
      mediaUrl?: string;
      ctaType?: string;
      ctaUrl?: string;
      couponCode?: string;
      offerTerms?: string;
      eventTitle?: string;
      eventStart?: string;
      eventEnd?: string;
      scheduledAt?: string;
    }
  >({
    mutationFn: async ({ locationId, ...body }) => {
      const res = await apiClient.post(
        `/gbp/locations/${locationId}/posts`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gbp-posts'] });
    },
  });
}

export function useGbpAiPostDraft() {
  return useMutation<
    GbpAiPostDraft,
    Error,
    { locationId: string; type?: GbpPostType; topic?: string; tone?: string }
  >({
    mutationFn: async ({ locationId, ...body }) => {
      const res = await apiClient.post(
        `/gbp/locations/${locationId}/posts/ai-draft`,
        body,
      );
      return res.data.data;
    },
  });
}

export function useDeleteGbpPost() {
  const qc = useQueryClient();
  return useMutation<{ deleted: boolean }, Error, string>({
    mutationFn: async (id) => {
      const res = await apiClient.delete(`/gbp/posts/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gbp-posts'] });
    },
  });
}

// ─── Edit Suggestions ───────────────────────────────────

export function useGbpEdits(locationId: string | null) {
  return useGet<GbpEditSuggestion[]>(
    `/gbp/locations/${locationId}/edits`,
    ['gbp-edits', locationId || ''],
    { enabled: !!locationId },
  );
}

export function useResolveGbpEdit() {
  const qc = useQueryClient();
  return useMutation<
    GbpEditSuggestion,
    Error,
    { id: string; action: 'approve' | 'reject' }
  >({
    mutationFn: async ({ id, action }) => {
      const res = await apiClient.post(`/gbp/edits/${id}/${action}`, {});
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gbp-edits'] });
      qc.invalidateQueries({ queryKey: ['gbp-locations'] });
    },
  });
}
