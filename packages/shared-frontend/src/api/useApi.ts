import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './apiClient';

const DEFAULT_STALE_TIME = 5 * 60 * 1000;

export class BusinessLogicError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'BusinessLogicError';
  }
}

export const useGet = <TData = any>(url: string, queryKey?: string[], options?: { enabled?: boolean; staleTime?: number }) => {
  return useQuery<TData>({
    queryKey: queryKey || [url],
    queryFn: async () => {
      const response = await apiClient.get(url);
      if (response.data?.success !== undefined) {
        if (response.data.success) return response.data.data;
        throw new BusinessLogicError(response.data.message || 'Request failed');
      }
      return response.data;
    },
    staleTime: options?.staleTime || DEFAULT_STALE_TIME,
    enabled: options?.enabled ?? true,
    retry: false,
  });
};

export const usePost = <TData = any>(invalidateKeys?: string[]) => {
  const queryClient = useQueryClient();
  return useMutation<TData, BusinessLogicError, { url: string; body: any }>({
    mutationFn: async ({ url, body }) => {
      const response = await apiClient.post(url, body);
      if (response.data?.success !== undefined) {
        if (response.data.success) return response.data.data ?? response.data;
        throw new BusinessLogicError(response.data.message || 'Request failed');
      }
      return response.data?.data || response.data;
    },
    onSuccess: () => {
      invalidateKeys?.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
    },
  });
};

export const usePatch = <TData = any>(invalidateKeys?: string[]) => {
  const queryClient = useQueryClient();
  return useMutation<TData, BusinessLogicError, { url: string; body: any }>({
    mutationFn: async ({ url, body }) => {
      const response = await apiClient.patch(url, body);
      if (response.data?.success !== undefined) {
        if (response.data.success) return response.data.data;
        throw new BusinessLogicError(response.data.message || 'Request failed');
      }
      return response.data?.data || response.data;
    },
    onSuccess: () => {
      invalidateKeys?.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
    },
  });
};

export const usePut = <TData = any>(invalidateKeys?: string[]) => {
  const queryClient = useQueryClient();
  return useMutation<TData, BusinessLogicError, { url: string; body: any }>({
    mutationFn: async ({ url, body }) => {
      const response = await apiClient.put(url, body);
      if (response.data?.success !== undefined) {
        if (response.data.success) return response.data.data;
        throw new BusinessLogicError(response.data.message || 'Request failed');
      }
      return response.data?.data || response.data;
    },
    onSuccess: () => {
      invalidateKeys?.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
    },
  });
};

export const useDelete = <TData = any>(invalidateKeys?: string[]) => {
  const queryClient = useQueryClient();
  return useMutation<TData, BusinessLogicError, string>({
    mutationFn: async (url) => {
      const response = await apiClient.delete(url);
      if (response.data?.success !== undefined) {
        if (response.data.success) return response.data.data;
        throw new BusinessLogicError(response.data.message || 'Delete failed');
      }
      return response.data || { success: true };
    },
    onSuccess: () => {
      invalidateKeys?.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
    },
  });
};