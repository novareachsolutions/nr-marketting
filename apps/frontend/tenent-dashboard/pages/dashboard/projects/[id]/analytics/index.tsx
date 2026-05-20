import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProject } from '@/hooks/useProjects';
import {
  useGaStatus,
  useGaOverview,
  useGaSources,
  useGaTopPages,
  useGaTimeseries,
} from '@/hooks/useGoogleAnalytics';
import { BarChart3, PlugZap, AlertTriangle } from 'lucide-react';
import styles from './index.module.css';

const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then((m) => m.Area), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const PieChart = dynamic(() => import('recharts').then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then((m) => m.Cell), { ssr: false });
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false });

const CHANNEL_COLORS: Record<string, string> = {
  'Organic Search': '#22c55e',
  Direct: '#6366f1',
  Referral: '#f59e0b',
  'Organic Social': '#ec4899',
  'Paid Search': '#3b82f6',
  Email: '#14b8a6',
  Display: '#8b5cf6',
  Unassigned: '#94a3b8',
};
const FALLBACK_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6', '#8b5cf6', '#94a3b8'];

const RANGES = [
  { label: '7d', days: 7 },
  { label: '28d', days: 28 },
  { label: '90d', days: 90 },
];

function formatNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <div className={`${styles.metricDelta} ${styles.deltaFlat}`}>—</div>;
  const up = value > 0;
  const flat = Math.abs(value) < 0.05;
  const cls = flat ? styles.deltaFlat : up ? styles.deltaUp : styles.deltaDown;
  const arrow = flat ? '→' : up ? '↑' : '↓';
  return (
    <div className={`${styles.metricDelta} ${cls}`}>
      {arrow} {Math.abs(value).toFixed(1)}% vs prev.
    </div>
  );
}

function AnalyticsContent() {
  const router = useRouter();
  const id = router.query.id as string;
  const { data: project } = useProject(id);
  const [days, setDays] = useState(28);

  const domain = project?.domain || '';

  const { data: status, isLoading: statusLoading } = useGaStatus(domain);
  const dataEnabled = !!status?.implemented;

  const { data: overview, isLoading: overviewLoading } = useGaOverview(domain, days, dataEnabled);
  const { data: sources } = useGaSources(domain, days, dataEnabled);
  const { data: topPages } = useGaTopPages(domain, days, dataEnabled);
  const { data: timeseries } = useGaTimeseries(domain, days, dataEnabled);

  const shell = (body: React.ReactNode) => (
    <div className={styles.layout}>
      <Head><title>Analytics — {project?.name || 'Project'}</title></Head>
      <Sidebar projectId={id} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div className={styles.headerRow}>
            <h1 className={styles.pageTitle}>Google Analytics</h1>
            {!!domain && <span className={styles.domainChip}>{domain}</span>}
            {status?.implemented && (
              <span className={`${styles.statusPill} ${styles.pillLive}`}>
                <span className={styles.dot} /> Live data
              </span>
            )}
            {status?.implemented && (
              <div className={styles.rangeTabs}>
                {RANGES.map((r) => (
                  <button
                    key={r.days}
                    className={`${styles.rangeTab} ${days === r.days ? styles.rangeTabActive : ''}`}
                    onClick={() => setDays(r.days)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {body}
        </main>
      </div>
    </div>
  );

  if (!project || statusLoading) {
    return shell(<div className={styles.loadingState}>Loading…</div>);
  }

  // Not connected to Google at all.
  if (!status?.connected) {
    return shell(
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}><PlugZap size={26} /></div>
        <h2 className={styles.emptyTitle}>Connect Google Analytics</h2>
        <p className={styles.emptyDesc}>
          Link your Google account to pull real traffic data for <strong>{domain}</strong>.
          We&apos;ll automatically match the right GA4 property to this project.
        </p>
        <Link href="/settings/integrations" className={styles.primaryBtn}>
          Connect Google Account
        </Link>
      </div>,
    );
  }

  // Connected, but no GA4 property matches this project's domain.
  if (!status.matched) {
    return shell(
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}><AlertTriangle size={26} /></div>
        <h2 className={styles.emptyTitle}>Google Analytics not detected on this domain</h2>
        <p className={styles.emptyDesc}>
          Your Google account is connected, but none of its GA4 properties have a web
          data stream pointing to <strong>{domain}</strong>. That usually means GA4
          isn&apos;t set up on this site yet.
        </p>
        <ol className={styles.emptySteps}>
          <li>Create a GA4 property for <strong>{domain}</strong> in Google Analytics.</li>
          <li>Add a <strong>Web data stream</strong> with this domain as the website URL.</li>
          <li>Install the GA4 tag (gtag.js or Google Tag Manager) on the site.</li>
          <li>Make sure the connected Google account has access to that property.</li>
        </ol>
        <a
          href="https://support.google.com/analytics/answer/9304153"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.primaryBtn}
        >
          How to set up GA4
        </a>
      </div>,
    );
  }

  // Property matched, but no data has been reported yet (tag not firing).
  if (!status.implemented) {
    return shell(
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}><BarChart3 size={26} /></div>
        <h2 className={styles.emptyTitle}>No analytics data yet</h2>
        <p className={styles.emptyDesc}>
          We matched the GA4 property <strong>{status.propertyName}</strong> to {domain},
          but it hasn&apos;t reported any sessions recently. If you just installed the
          tag, data can take up to 24–48 hours to appear. Otherwise, verify the GA4 tag
          is firing on the live site.
        </p>
      </div>,
    );
  }

  // Fully implemented — show the dashboard.
  const pieData = (sources || []).map((s) => ({ name: s.channel, value: s.sessions }));

  return shell(
    <>
      {overviewLoading && <div className={styles.loadingState}>Loading metrics…</div>}

      {overview && (
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Sessions</div>
            <div className={styles.metricValue}>{formatNum(overview.sessions)}</div>
            <Delta value={overview.sessionsChange} />
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Users</div>
            <div className={styles.metricValue}>{formatNum(overview.totalUsers)}</div>
            <Delta value={overview.usersChange} />
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Pageviews</div>
            <div className={styles.metricValue}>{formatNum(overview.screenPageViews)}</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Engagement Rate</div>
            <div className={styles.metricValue}>{(overview.engagementRate * 100).toFixed(1)}%</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Avg. Session</div>
            <div className={styles.metricValue}>{formatDuration(overview.avgSessionDuration)}</div>
          </div>
        </div>
      )}

      {timeseries && timeseries.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Sessions over time</div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timeseries}>
              <defs>
                <linearGradient id="gaSessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={{ stroke: 'var(--border-primary)' }} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatNum(v)} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="sessions" stroke="#6366f1" strokeWidth={2} fill="url(#gaSessions)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className={styles.twoCol}>
        {sources && sources.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Traffic by channel</div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={CHANNEL_COLORS[entry.name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatNum(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {topPages && topPages.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Top pages</div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Page</th>
                  <th className={styles.numCell}>Views</th>
                  <th className={styles.numCell}>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {topPages.slice(0, 12).map((p, i) => (
                  <tr key={i}>
                    <td className={styles.pageCell} title={p.page}>{p.page}</td>
                    <td className={styles.numCell}>{formatNum(p.screenPageViews)}</td>
                    <td className={styles.numCell}>{formatNum(p.sessions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>,
  );
}

export default function ProjectAnalyticsPage() {
  return (
    <AuthGuard>
      <AnalyticsContent />
    </AuthGuard>
  );
}
