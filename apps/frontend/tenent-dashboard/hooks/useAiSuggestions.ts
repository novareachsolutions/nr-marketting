import { usePost } from '@repo/shared-frontend';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@repo/shared-frontend';

interface AiSuggestionsResponse {
  suggestions: string[];
}

export function useAiSuggestions(
  module: string,
  context: Record<string, any> | null,
) {
  return useQuery<AiSuggestionsResponse>({
    queryKey: ['ai-suggestions', module, JSON.stringify(context)],
    queryFn: async () => {
      const res = await apiClient.post('/ai-suggestions', { module, context });
      return res.data.data;
    },
    enabled: !!context && Object.keys(context).length > 0,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    retry: false,
  });
}
