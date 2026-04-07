import { useGet } from '@repo/shared-frontend';
import type { KeywordGapData } from '@/types/keyword-gap';

export function useKeywordGap(domains: string, country: string = 'US') {
  return useGet<KeywordGapData>(
    `/keyword-gap?domains=${encodeURIComponent(domains)}&country=${country}`,
    ['keyword-gap', domains, country],
    { enabled: !!domains },
  );
}
