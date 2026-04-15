export interface WritingDocument {
  id: string;
  title: string;
  content: string;
  plainText: string;
  targetKeywords: string[] | null;
  metaDescription: string | null;
  readabilityScore: number | null;
  seoScore: number | null;
  originalityScore: number | null;
  toneScore: number | null;
  overallScore: number | null;
  targetTone: string | null;
  wordCount: number;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WritingDocumentListItem {
  id: string;
  title: string;
  wordCount: number;
  overallScore: number | null;
  readabilityScore: number | null;
  seoScore: number | null;
  originalityScore: number | null;
  toneScore: number | null;
  targetTone: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WritingDocumentListResponse {
  documents: WritingDocumentListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface RephraseResponse {
  result: string;
}

export interface ComposeResponse {
  content: string;
  outline?: string[];
}

export interface AskAiResponse {
  answer: string;
}

export interface OriginalityResponse {
  score: number;
  flags: { sentence: string; concern: string }[];
}

export interface ToneResponse {
  score: number;
  detectedTone: string;
  segments: { text: string; tone: string; consistent: boolean }[];
}

export interface SeoKeywordData {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
}

export interface SeoAnalysisResponse {
  keywords: SeoKeywordData[];
}

export type RephraseMode = 'simplify' | 'expand' | 'rephrase' | 'summarize';
export type ToneType = 'formal' | 'casual' | 'neutral';
export type ContentType = 'paragraph' | 'outline' | 'intro' | 'conclusion' | 'listicle';
