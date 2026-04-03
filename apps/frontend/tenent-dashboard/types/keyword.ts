export type SearchIntent = 'INFORMATIONAL' | 'NAVIGATIONAL' | 'COMMERCIAL' | 'TRANSACTIONAL';

export interface KeywordData {
  keyword: string;
  country: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  trend: number[] | null;
  competition: string;
  intent: SearchIntent;
  wordCount: number;
  isQuestion: boolean;
  priorityScore: number;
}

export interface KeywordSuggestion {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  competition: string;
  intent: SearchIntent;
  wordCount: number;
  isQuestion: boolean;
  priorityScore: number;
}

export interface SuggestionsResponse {
  keywords: KeywordSuggestion[];
  total: number;
  clusters?: Record<string, KeywordSuggestion[]>;
}

export interface ProjectKeyword {
  id: string;
  projectId: string;
  keyword: string;
  targetUrl: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ProjectKeywordsResponse {
  keywords: ProjectKeyword[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// Keyword Gap
export interface KeywordGapResponse {
  yourDomain: string;
  competitors: string[];
  yourKeywordCount: number;
  summary: {
    missing: number;
    shared: number;
    unique: number;
  };
  missingKeywords: KeywordSuggestion[];
  sharedKeywords: string[];
  uniqueKeywords: string[];
}

// Suggestion filters
export interface SuggestionFilters {
  minVolume?: number;
  maxVolume?: number;
  minKd?: number;
  maxKd?: number;
  intent?: SearchIntent;
  questionsOnly?: boolean;
  minWords?: number;
  maxWords?: number;
  matchType?: 'broad' | 'phrase' | 'exact' | 'questions';
  includeWords?: string;
  excludeWords?: string;
}

// Export
export interface KeywordExportData {
  project: { domain: string; name: string };
  keywords: {
    keyword: string;
    targetUrl: string | null;
    notes: string | null;
    searchVolume: number | null;
    difficulty: number | null;
    cpc: number | null;
    competition: string;
    intent: SearchIntent;
    wordCount: number;
    isQuestion: boolean;
    priorityScore: number;
    savedAt: string;
  }[];
  exportedAt: string;
}
