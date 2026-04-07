// ─── Number Formatting ─────────────────────────────────────

export function formatVolume(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

export function formatCurrency(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

// ─── Color Helpers ──────────────────────────────���──────────

export function getPositionColor(pos: number | null): string {
  if (pos === null) return 'var(--text-tertiary)';
  if (pos <= 3) return '#22c55e';
  if (pos <= 10) return '#34d399';
  if (pos <= 20) return '#eab308';
  if (pos <= 50) return '#f97316';
  return '#ef4444';
}

export function getDifficultyColor(d: number | null): string {
  if (d === null) return 'var(--text-tertiary)';
  if (d < 25) return '#22c55e';
  if (d < 50) return '#eab308';
  if (d < 75) return '#f97316';
  return '#ef4444';
}

export function getDifficultyLabel(d: number | null): string {
  if (d === null) return '--';
  if (d < 25) return 'Easy';
  if (d < 50) return 'Medium';
  if (d < 75) return 'Hard';
  return 'Very Hard';
}

export function getAuthorityColor(score: number | null): string {
  if (score === null) return 'var(--text-tertiary)';
  if (score >= 70) return '#22c55e';
  if (score >= 50) return '#eab308';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

// ─── Constants ─────────────────────────────────────────────

export const INTENT_COLORS: Record<string, string> = {
  informational: '#3b82f6',
  navigational: '#8b5cf6',
  commercial: '#f59e0b',
  transactional: '#22c55e',
  INFORMATIONAL: '#3b82f6',
  NAVIGATIONAL: '#8b5cf6',
  COMMERCIAL: '#f59e0b',
  TRANSACTIONAL: '#22c55e',
};

export const INTENT_LABELS: Record<string, string> = {
  informational: 'I',
  navigational: 'N',
  commercial: 'C',
  transactional: 'T',
  INFORMATIONAL: 'I',
  NAVIGATIONAL: 'N',
  COMMERCIAL: 'C',
  TRANSACTIONAL: 'T',
};

export const DOMAIN_COLORS = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6'];

export const SERP_ABBREV: Record<string, string> = {
  featured_snippet: 'FS',
  sitelinks: 'SL',
  people_also_ask: 'PAA',
  image_pack: 'IMG',
  video: 'VID',
  knowledge_panel: 'KP',
  local_pack: 'LP',
  reviews: 'REV',
  top_stories: 'TS',
  shopping: 'SHOP',
};

export const COUNTRIES = ['AU', 'US', 'GB', 'CA', 'IN', 'DE', 'FR', 'ES', 'IT', 'BR', 'JP'];
