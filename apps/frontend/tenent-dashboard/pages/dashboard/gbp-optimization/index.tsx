import { useState, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import {
  useGbpStatus,
  useGbpLocations,
  useGbpInsights,
  useSyncGbpLocations,
} from '@/hooks/useGbpOptimization';
import {
  MapPin,
  RefreshCw,
  Loader2,
  Eye,
  Globe,
  Phone,
  Navigation,
  CalendarCheck,
  Star,
  MessageSquare,
  FileText,
  CheckCircle2,
  AlertCircle,
  Plug,
} from 'lucide-react';
import styles from './index.module.css';

const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false },
);
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), {
  ssr: false,
});
const Line = dynamic(() => import('recharts').then((m) => m.Line), {
  ssr: false,
});
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), {
  ssr: false,
});
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), {
  ssr: false,
});
const CartesianGrid = dynamic(
  () => import('recharts').then((m) => m.CartesianGrid),
  { ssr: false },
);
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), {
  ssr: false,
});

function formatNumber(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function GbpDashboardContent() {
  const { data: status, isLoading: statusLoading } = useGbpStatus();
  const { data: locations = [], isLoading: locLoading } = useGbpLocations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [months, setMonths] = useState(12);

  const syncMutation = useSyncGbpLocations();

  const activeLocationId =
    selectedId || (locations.length > 0 ? locations[0].id : null);
  const activeLocation = useMemo(
    () => locations.find((l) => l.id === activeLocationId) || null,
    [locations, activeLocationId],
  );

  const { data: insights, isLoading: insightsLoading } = useGbpInsights(
    activeLocationId,
    months,
  );

  // ─── Connect CTA ──────────────────────────────────────
  if (!statusLoading && (!status?.connected || !status?.hasGbpScope)) {
    return (
      <div className={styles.layout}>
        <Head>
          <title>GBP Optimization — NR SEO</title>
        </Head>
        <Sidebar />
        <div className={sidebarStyles.contentWithSidebar}>
          <main className={styles.main}>
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>GBP Optimization</h1>
            </div>
            <p className={styles.pageSubtitle}>
              Manage your Google Business Profile, respond to reviews, post
              updates, and track local search performance.
            </p>
            <div className={styles.connectCard}>
              <div className={styles.connectIcon}>
                <Plug size={28} />
              </div>
              <h2 className={styles.connectTitle}>Connect Google Business Profile</h2>
              <p className={styles.connectText}>
                Connect your Google account to sync your business locations,
                track performance insights, manage reviews, and publish posts
                directly from NR SEO.
              </p>
              <Link
                href="/dashboard/gbp-optimization/connect"
                className={styles.primaryBtn}
              >
                <Plug size={14} /> Connect GBP
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ─── No locations yet ─────────────────────────────────
  if (!locLoading && locations.length === 0) {
    return (
      <div className={styles.layout}>
        <Head>
          <title>GBP Optimization — NR SEO</title>
        </Head>
        <Sidebar />
        <div className={sidebarStyles.contentWithSidebar}>
          <main className={styles.main}>
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>GBP Optimization</h1>
              <div className={styles.headerActions}>
                <button
                  className={styles.primaryBtn}
                  disabled={syncMutation.isPending}
                  onClick={() => syncMutation.mutate()}
                >
                  {syncMutation.isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} /> Sync locations
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className={styles.pageSubtitle}>
              No locations synced yet. Click &ldquo;Sync locations&rdquo; to
              import your Google Business Profile listings.
            </p>
            <div className={styles.emptyState}>
              <div className={styles.emptyTitle}>No GBP locations found</div>
              <p className={styles.emptyText}>
                Once synced, you&apos;ll be able to manage business info,
                reviews, posts, and insights for every location you own.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <Head>
        <title>GBP Optimization — NR SEO</title>
      </Head>
      <Sidebar />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>GBP Optimization</h1>
            <div className={styles.headerActions}>
              <button
                className={styles.syncBtn}
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate()}
              >
                {syncMutation.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} /> Sync
                  </>
                )}
              </button>
            </div>
          </div>
          <p className={styles.pageSubtitle}>
            Manage your Google Business Profile, track performance, respond to
            reviews, and schedule posts from one dashboard.
          </p>

          {/* Location picker */}
          {locations.length > 1 && (
            <div className={styles.formRow} style={{ marginBottom: 16 }}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Location</label>
                <select
                  className={styles.formSelect}
                  value={activeLocationId || ''}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Period</label>
                <select
                  className={styles.formSelect}
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                >
                  <option value={1}>Last month</option>
                  <option value={3}>Last 3 months</option>
                  <option value={6}>Last 6 months</option>
                  <option value={12}>Last 12 months</option>
                  <option value={24}>Last 24 months</option>
                </select>
              </div>
            </div>
          )}

          {/* Location card */}
          {activeLocation && (
            <div className={styles.locationCard}>
              <div className={styles.locationAvatar}>
                <MapPin size={28} />
              </div>
              <div>
                <h2 className={styles.locationName}>{activeLocation.name}</h2>
                <div className={styles.locationMeta}>
                  <span>
                    {[
                      activeLocation.addressLine1,
                      activeLocation.city,
                      activeLocation.region,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                  {activeLocation.primaryCategory && (
                    <span>· {activeLocation.primaryCategory}</span>
                  )}
                  {activeLocation.verificationState === 'VERIFIED' ? (
                    <span className={styles.verifiedBadge}>
                      <CheckCircle2 size={12} /> Verified
                    </span>
                  ) : (
                    <span className={styles.unverifiedBadge}>
                      <AlertCircle size={12} /> Unverified
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.completenessWrap}>
                <div className={styles.completenessLabel}>
                  Profile completeness
                </div>
                <div className={styles.completenessBar}>
                  <div
                    className={styles.completenessFill}
                    style={{ width: `${activeLocation.completenessScore}%` }}
                  />
                </div>
                <div className={styles.completenessVal}>
                  {activeLocation.completenessScore}%
                </div>
              </div>
            </div>
          )}

          {/* Quick nav */}
          <div className={styles.tabs}>
            <div className={`${styles.tab} ${styles.tabActive}`}>
              <Eye size={14} /> Insights
            </div>
            <Link
              href={`/dashboard/gbp-optimization/reviews?locationId=${activeLocationId || ''}`}
              className={styles.tab}
            >
              <MessageSquare size={14} /> Reviews
              {activeLocation?._count?.reviews !== undefined && (
                <span className={styles.tabBadge}>
                  {activeLocation._count.reviews}
                </span>
              )}
            </Link>
            <Link
              href={`/dashboard/gbp-optimization/posts?locationId=${activeLocationId || ''}`}
              className={styles.tab}
            >
              <FileText size={14} /> Posts
              {activeLocation?._count?.posts !== undefined && (
                <span className={styles.tabBadge}>
                  {activeLocation._count.posts}
                </span>
              )}
            </Link>
          </div>

          {insightsLoading && (
            <div className={styles.loadingState}>
              <Loader2 size={16} className="animate-spin" /> Loading insights...
            </div>
          )}

          {/* Metric cards */}
          {insights && !insightsLoading && (
            <>
              <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>
                    <Eye size={12} /> Profile Views
                  </div>
                  <div className={styles.metricValue}>
                    {formatNumber(
                      insights.totals.profileViewsMaps +
                        insights.totals.profileViewsSearch,
                    )}
                  </div>
                  <div className={styles.metricSub}>
                    {formatNumber(insights.totals.profileViewsMaps)} Maps ·{' '}
                    {formatNumber(insights.totals.profileViewsSearch)} Search
                  </div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>
                    <Globe size={12} /> Website Clicks
                  </div>
                  <div className={styles.metricValue}>
                    {formatNumber(insights.totals.websiteClicks)}
                  </div>
                  <div className={styles.metricSub}>
                    Period: last {insights.periodMonths} months
                  </div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>
                    <Phone size={12} /> Calls
                  </div>
                  <div className={styles.metricValue}>
                    {formatNumber(insights.totals.callClicks)}
                  </div>
                  <div className={styles.metricSub}>Click-to-call from GBP</div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>
                    <Navigation size={12} /> Directions
                  </div>
                  <div className={styles.metricValue}>
                    {formatNumber(insights.totals.directionRequests)}
                  </div>
                  <div className={styles.metricSub}>Direction requests</div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>
                    <CalendarCheck size={12} /> Bookings
                  </div>
                  <div className={styles.metricValue}>
                    {formatNumber(insights.totals.bookingClicks)}
                  </div>
                  <div className={styles.metricSub}>Booking clicks</div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>
                    <Star size={12} /> Rating
                  </div>
                  <div className={styles.metricValue}>--</div>
                  <div className={styles.metricSub}>See Reviews tab</div>
                </div>
              </div>

              {/* Trend chart */}
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>Performance trend</h3>
                <div className={styles.chartHeight}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={insights.monthlyTrend}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border-primary)"
                      />
                      <XAxis
                        dataKey="month"
                        fontSize={11}
                        stroke="var(--text-tertiary)"
                      />
                      <YAxis fontSize={11} stroke="var(--text-tertiary)" />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="profileViews"
                        name="Profile Views"
                        stroke="#16a34a"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="websiteClicks"
                        name="Website Clicks"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="calls"
                        name="Calls"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="directions"
                        name="Directions"
                        stroke="#a855f7"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function GbpOptimizationPage() {
  return (
    <AuthGuard>
      <GbpDashboardContent />
    </AuthGuard>
  );
}
