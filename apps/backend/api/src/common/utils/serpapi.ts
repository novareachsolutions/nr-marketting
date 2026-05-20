import axios from 'axios';

const SERPAPI_URL = 'https://serpapi.com/search.json';

export interface SerpOrganicResult {
  position: number;
  title: string;
  link: string;
  displayedLink: string;
  snippet: string;
  domain: string;
  sitelinks: boolean;
  rating: number | null;
}

export interface SerpSearchResult {
  organicResults: SerpOrganicResult[];
  relatedSearches: string[];
  relatedQuestions: string[];
  serpFeatures: string[];
  answerBox: any;
  totalResults: number | null;
}

export interface SerpSearchOptions {
  apiKey: string;
  query: string;
  country?: string;
  device?: 'desktop' | 'mobile' | 'tablet';
  num?: number;
  timeout?: number;
}

const SERP_FEATURE_LIST = [
  'featured_snippet',
  'people_also_ask',
  'sitelinks',
  'local_pack',
  'knowledge_graph',
  'video',
  'image_pack',
  'top_stories',
  'shopping',
  'reviews',
];

export function isSerpApiConfigured(apiKey?: string | null): boolean {
  return !!apiKey && apiKey.length > 0;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function detectSerpFeatures(data: any): string[] {
  const features: string[] = [];
  if (data.answer_box || data.answer_box_list) features.push('featured_snippet');
  if (data.related_questions || data.questions || data.people_also_ask)
    features.push('people_also_ask');
  if (data.knowledge_graph) features.push('knowledge_graph');
  if (data.local_results || data.local_map) features.push('local_pack');
  if (data.inline_videos || data.videos || data.video_results) features.push('video');
  if (data.inline_images || data.images_results) features.push('image_pack');
  if (data.top_stories || data.top_stories_link) features.push('top_stories');
  if (data.shopping_results || data.inline_shopping) features.push('shopping');
  const organic = Array.isArray(data.organic_results) ? data.organic_results : [];
  if (organic.some((r: any) => Array.isArray(r.sitelinks) || r.sitelinks?.inline || r.sitelinks?.expanded))
    features.push('sitelinks');
  if (
    organic.some(
      (r: any) =>
        r.rich_snippet?.top?.detected_extensions?.rating ||
        r.rich_snippet?.bottom?.detected_extensions?.rating ||
        r.rating,
    )
  )
    features.push('reviews');
  return features.filter((f) => SERP_FEATURE_LIST.includes(f));
}

export async function serpApiSearch(
  opts: SerpSearchOptions,
): Promise<SerpSearchResult> {
  const {
    apiKey,
    query,
    country = 'US',
    device = 'desktop',
    num = 100,
    timeout = 30000,
  } = opts;

  const response = await axios.get(SERPAPI_URL, {
    params: {
      api_key: apiKey,
      engine: 'google',
      q: query,
      gl: country.toLowerCase(),
      hl: 'en',
      device,
      num,
    },
    timeout,
  });

  const data = response.data || {};
  const organicRaw: any[] = Array.isArray(data.organic_results)
    ? data.organic_results
    : [];

  const organicResults: SerpOrganicResult[] = organicRaw.map((r: any) => ({
    position: typeof r.position === 'number' ? r.position : 0,
    title: r.title || '',
    link: r.link || '',
    displayedLink: r.displayed_link || '',
    snippet: r.snippet || '',
    domain: extractDomain(r.link || ''),
    sitelinks: Boolean(r.sitelinks),
    rating:
      r.rich_snippet?.top?.detected_extensions?.rating ??
      r.rich_snippet?.bottom?.detected_extensions?.rating ??
      r.rating ??
      null,
  }));

  const relatedSearches: string[] = (data.related_searches || [])
    .map((r: any) => (typeof r === 'string' ? r : r.query))
    .filter((s: any) => typeof s === 'string' && s.length > 0);

  const relatedQuestions: string[] = (
    data.related_questions ||
    data.questions ||
    data.people_also_ask ||
    []
  )
    .map((q: any) => (typeof q === 'string' ? q : q.question))
    .filter((s: any) => typeof s === 'string' && s.length > 0);

  return {
    organicResults,
    relatedSearches,
    relatedQuestions,
    serpFeatures: detectSerpFeatures(data),
    answerBox: data.answer_box || null,
    totalResults:
      typeof data.search_information?.total_results === 'number'
        ? data.search_information.total_results
        : null,
  };
}

export interface SerpAutocompleteOptions {
  apiKey: string;
  query: string;
  country?: string;
  timeout?: number;
}

export async function serpApiAutocomplete(
  opts: SerpAutocompleteOptions,
): Promise<string[]> {
  const { apiKey, query, country = 'US', timeout = 15000 } = opts;

  const response = await axios.get(SERPAPI_URL, {
    params: {
      api_key: apiKey,
      engine: 'google_autocomplete',
      q: query,
      gl: country.toLowerCase(),
      hl: 'en',
    },
    timeout,
  });

  const suggestions = response.data?.suggestions || [];
  return suggestions
    .map((s: any) => (typeof s === 'string' ? s : s.value))
    .filter((s: any) => typeof s === 'string' && s.length > 0);
}

/**
 * Find the best position of a domain in SERP organic results.
 * Returns position, ranking URL, or null if not in results.
 */
export function findDomainPosition(
  organicResults: SerpOrganicResult[],
  domain: string,
): { position: number | null; rankingUrl: string | null } {
  const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();

  for (const result of organicResults) {
    if (!result.domain) continue;
    const resultDomain = result.domain.toLowerCase();
    if (
      resultDomain === normalizedDomain ||
      resultDomain.endsWith('.' + normalizedDomain) ||
      normalizedDomain.endsWith('.' + resultDomain)
    ) {
      return { position: result.position, rankingUrl: result.link };
    }
  }

  return { position: null, rankingUrl: null };
}
