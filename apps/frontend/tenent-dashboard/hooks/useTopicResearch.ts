import { useGet } from '@repo/shared-frontend';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@repo/shared-frontend';
import type {
  TopicResearchResponse,
  SubtopicResponse,
  TopicResearchFilters,
  AiTopicSuggestion,
} from '@/types/topic-research';

export function useTopicResearch(
  topic: string,
  country: string = 'AU',
  domain?: string,
  filters?: TopicResearchFilters,
) {
  const params = new URLSearchParams();
  params.set('topic', topic);
  params.set('country', country);
  if (domain) params.set('domain', domain);

  if (filters) {
    if (filters.minVolume !== undefined) params.set('minVolume', String(filters.minVolume));
    if (filters.maxVolume !== undefined) params.set('maxVolume', String(filters.maxVolume));
    if (filters.maxKd !== undefined) params.set('maxKd', String(filters.maxKd));
    if (filters.minEfficiency !== undefined) params.set('minEfficiency', String(filters.minEfficiency));
    if (filters.intent) params.set('intent', filters.intent);
    if (filters.questionsOnly) params.set('questionsOnly', 'true');
  }

  const filterKey = filters ? JSON.stringify(filters) : '';

  return useGet<TopicResearchResponse>(
    `/topics/research?${params.toString()}`,
    ['topic-research', topic, country, domain || '', filterKey],
    { enabled: !!topic },
  );
}

export function useSubtopics(
  topic: string,
  parentTopic: string,
  country: string = 'AU',
  page: number = 1,
) {
  return useGet<SubtopicResponse>(
    `/topics/subtopics?topic=${encodeURIComponent(topic)}&parentTopic=${encodeURIComponent(parentTopic)}&country=${country}&page=${page}`,
    ['topic-subtopics', topic, parentTopic, country, String(page)],
    { enabled: !!topic && !!parentTopic },
  );
}

export function useAiTopicSuggestions(
  domain: string | null,
  competitors: string[],
  enabled: boolean = false,
) {
  return useQuery<{ suggestions: AiTopicSuggestion[] }>({
    queryKey: ['ai-topic-suggestions', domain, JSON.stringify(competitors)],
    queryFn: async () => {
      const res = await apiClient.post('/ai-suggestions', {
        module: 'topic-research',
        context: { domain, competitors },
      });
      return res.data.data;
    },
    enabled: enabled && !!domain,
    staleTime: 7 * 24 * 60 * 60 * 1000,
    retry: false,
  });
}
