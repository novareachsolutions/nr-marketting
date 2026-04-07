/**
 * Normalize a domain input by stripping protocol, www, path, query, fragment.
 * E.g. "https://www.Example.com/page?q=1" → "example.com"
 */
export function normalizeDomain(input: string): string {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/^www\./, '');
  domain = domain.split('/')[0].split('?')[0].split('#')[0];
  domain = domain.replace(/\.$/, '');
  return domain;
}

/**
 * Simple string hash for deterministic data generation.
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
