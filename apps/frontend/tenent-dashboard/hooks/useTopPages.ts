import { useGet } from '@repo/shared-frontend';
import type { TopPagesData } from '@/types/top-pages';

export function useTopPages(domain: string, country: string = 'US') {
  return useGet<TopPagesData>(
    `/top-pages?domain=${encodeURIComponent(domain)}&country=${country}`,
    ['top-pages', domain, country],
    { enabled: !!domain },
  );
}
