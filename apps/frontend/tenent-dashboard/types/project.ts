export interface Project {
  id: string;
  userId: string;
  domain: string;
  name: string;
  timezone: string;
  sourceType: 'MANUAL' | 'WORDPRESS' | 'GITHUB';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    competitors: number;
    trackedKeywords: number;
    crawlJobs: number;
    projectKeywords?: number;
    conversations?: number;
    reports?: number;
  };
  competitors?: Competitor[];
}

export interface Competitor {
  id: string;
  projectId: string;
  domain: string;
  name: string | null;
  createdAt: string;
}
