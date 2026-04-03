import { useGet } from '@repo/shared-frontend';
import type { DomainOverviewData } from '@/types/domain-overview';

export function useDomainOverview(domain: string, country: string = 'US') {
  return useGet<DomainOverviewData>(
    `/domain-overview?domain=${encodeURIComponent(domain)}&country=${country}`,
    ['domain-overview', domain, country],
    { enabled: !!domain },
  );
}
