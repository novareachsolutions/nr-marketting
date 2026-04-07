import { useGet } from '@repo/shared-frontend';
import type { BacklinkGapData } from '@/types/backlink-gap';

export function useBacklinkGap(domains: string, country: string = 'US') {
  return useGet<BacklinkGapData>(
    `/backlink-gap?domains=${encodeURIComponent(domains)}&country=${country}`,
    ['backlink-gap', domains, country],
    { enabled: !!domains },
  );
}
