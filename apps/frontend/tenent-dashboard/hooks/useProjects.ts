import { useGet, usePost, usePut, useDelete } from '@repo/shared-frontend';
import type { Project, Competitor } from '@/types/project';

export function useProjects() {
  return useGet<Project[]>('/projects', ['projects']);
}

export function useProject(id: string) {
  return useGet<Project>(`/projects/${id}`, ['project', id], {
    enabled: !!id,
  });
}

export function useCreateProject() {
  return usePost<Project>(['projects']);
}

export function useUpdateProject() {
  return usePut<Project>(['projects']);
}

export function useDeleteProject() {
  return useDelete<{ message: string }>(['projects']);
}

export function useCompetitors(projectId: string) {
  return useGet<Competitor[]>(`/projects/${projectId}/competitors`, [
    'competitors',
    projectId,
  ], { enabled: !!projectId });
}

export function useAddCompetitor() {
  return usePost<Competitor>(['competitors']);
}

export function useRemoveCompetitor() {
  return useDelete<{ message: string }>(['competitors']);
}
