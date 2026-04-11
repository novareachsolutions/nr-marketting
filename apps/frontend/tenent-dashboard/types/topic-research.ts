export type SearchIntent = 'INFORMATIONAL' | 'NAVIGATIONAL' | 'COMMERCIAL' | 'TRANSACTIONAL';

export interface TopicCard {
  topic: string;
  searchVolume: number | null;
  difficulty: number | null;
  topicEfficiency: number | null;
  subtopicCount: number;
  intent: SearchIntent;
}

export interface Subtopic {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  intent: SearchIntent;
  topicEfficiency: number | null;
  isQuestion: boolean;
  wordCount: number;
}

export interface TopicResearchResponse {
  topic: string;
  country: string;
  cards: TopicCard[];
  total: number;
}

export interface SubtopicResponse {
  topic: string;
  subtopics: Subtopic[];
  total: number;
  page: number;
  totalPages: number;
  headlines: string[];
  questions: string[];
}

export interface TopicResearchFilters {
  minVolume?: number;
  maxVolume?: number;
  maxKd?: number;
  minEfficiency?: number;
  intent?: SearchIntent;
  questionsOnly?: boolean;
}

export interface AiTopicSuggestion {
  topic: string;
  keywords: string[];
  reason: string;
}
