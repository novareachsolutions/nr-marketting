import { useGet } from '@repo/shared-frontend';
import type { OrganicRankingsData } from '@/types/organic-rankings';

export function useOrganicRankings(domain: string, country: string = 'US') {
  return useGet<OrganicRankingsData>(
    `/organic-rankings?domain=${encodeURIComponent(domain)}&country=${country}`,
    ['organic-rankings', domain, country],
    { enabled: !!domain },
  );
}
