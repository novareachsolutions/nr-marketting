import { useGet } from '@repo/shared-frontend';

export interface GaStatus {
  connected: boolean;
  matched: boolean;
  propertyId: string | null;
  propertyName: string | null;
  implemented: boolean;
}

export interface GaOverview {
  sessions: number;
  totalUsers: number;
  newUsers: number;
  screenPageViews: number;
  engagementRate: number;
  avgSessionDuration: number;
  sessionsChange: number | null;
  usersChange: number | null;
}

export interface GaSourceRow {
  channel: string;
  sessions: number;
  totalUsers: number;
}

export interface GaPageRow {
  page: string;
  screenPageViews: number;
  sessions: number;
}

export interface GaTimeseriesPoint {
  date: string;
  sessions: number;
  totalUsers: number;
}

const enc = encodeURIComponent;

export function useGaStatus(domain: string) {
  return useGet<GaStatus>(
    `/google-oauth/ga/status?domain=${enc(domain)}`,
    ['ga-status', domain],
    { enabled: !!domain },
  );
}

export function useGaOverview(domain: string, days = 28, enabled = true) {
  return useGet<GaOverview>(
    `/google-oauth/ga/overview?domain=${enc(domain)}&days=${days}`,
    ['ga-overview', domain, String(days)],
    { enabled: !!domain && enabled },
  );
}

export function useGaSources(domain: string, days = 28, enabled = true) {
  return useGet<GaSourceRow[]>(
    `/google-oauth/ga/sources?domain=${enc(domain)}&days=${days}`,
    ['ga-sources', domain, String(days)],
    { enabled: !!domain && enabled },
  );
}

export function useGaTopPages(domain: string, days = 28, enabled = true) {
  return useGet<GaPageRow[]>(
    `/google-oauth/ga/pages?domain=${enc(domain)}&days=${days}`,
    ['ga-pages', domain, String(days)],
    { enabled: !!domain && enabled },
  );
}

export function useGaTimeseries(domain: string, days = 28, enabled = true) {
  return useGet<GaTimeseriesPoint[]>(
    `/google-oauth/ga/timeseries?domain=${enc(domain)}&days=${days}`,
    ['ga-timeseries', domain, String(days)],
    { enabled: !!domain && enabled },
  );
}
