import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@repo/shared-frontend';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  plan: string;
  approvalStatus: ApprovalStatus;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  isEmailVerified: boolean;
  createdAt: string;
}

interface ListUsersResponse {
  users: AdminUserRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    pending: number;
    approved: number;
    rejected: number;
  };
}

interface UseAdminUsersParams {
  status: ApprovalStatus | 'ALL';
  search: string;
  page: number;
  pageSize: number;
}

export function useAdminUsers(params: UseAdminUsersParams) {
  return useQuery({
    queryKey: ['admin-users', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        success: boolean;
        data: ListUsersResponse;
      }>('/admin/users', {
        params: {
          status: params.status,
          search: params.search || undefined,
          page: params.page,
          pageSize: params.pageSize,
        },
      });
      return data.data;
    },
  });
}

export function useApproveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await apiClient.post(`/admin/users/${userId}/approve`);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useRejectUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { userId: string; reason?: string }) => {
      const { data } = await apiClient.post(
        `/admin/users/${params.userId}/reject`,
        { reason: params.reason },
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}
