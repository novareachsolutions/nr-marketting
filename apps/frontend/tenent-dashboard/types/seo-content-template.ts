export interface RivalItem {
  rank: number;
  url: string;
  title: string;
  snippet: string;
  totalOccurrences: number;
  exampleSentences: string[];
}

export interface SeoContentBrief {
  id: string;
  userId: string;
  projectId: string | null;
  targetKeywords: string[];
  country: string;
  topRivals: RivalItem[];
  backlinkTargets: string[];
  semanticKeywords: string[];
  avgReadability: number;
  recommendedWordCount: number;
  titleSuggestion: string;
  metaSuggestion: string;
  h1Suggestion: string;
  status: 'ready' | 'generating' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface SeoContentBriefListItem {
  id: string;
  targetKeywords: string[];
  country: string;
  avgReadability: number;
  recommendedWordCount: number;
  status: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeoContentBriefListResponse {
  briefs: SeoContentBriefListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface GenerateBriefInput {
  targetKeywords: string[];
  country?: string;
  projectId?: string;
}

export interface SendToWriterResponse {
  documentId: string;
}
