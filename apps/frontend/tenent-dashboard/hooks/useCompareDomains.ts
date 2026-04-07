import { useGet } from '@repo/shared-frontend';
import type { CompareDomainData } from '@/types/compare-domains';

export function useCompareDomains(domains: string, country: string = 'US') {
  return useGet<CompareDomainData>(
    `/compare-domains?domains=${encodeURIComponent(domains)}&country=${country}`,
    ['compare-domains', domains, country],
    { enabled: !!domains },
  );
}
