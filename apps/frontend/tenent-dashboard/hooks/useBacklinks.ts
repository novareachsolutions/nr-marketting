import { useGet } from '@repo/shared-frontend';
import type { BacklinksData } from '@/types/backlinks';

export function useBacklinks(domain: string, country: string = 'US') {
  return useGet<BacklinksData>(
    `/backlinks?domain=${encodeURIComponent(domain)}&country=${country}`,
    ['backlinks', domain, country],
    { enabled: !!domain },
  );
}
