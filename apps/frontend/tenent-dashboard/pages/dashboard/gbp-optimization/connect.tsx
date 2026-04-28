import Head from 'next/head';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useGbpStatus } from '@/hooks/useGbpOptimization';
import { ArrowLeft, Plug, CheckCircle2, MapPin } from 'lucide-react';
import styles from './index.module.css';

function GbpConnectContent() {
  const { data: status, isLoading } = useGbpStatus();

  const handleConnect = () => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('accessToken')
        : null;
    if (!token) {
      window.location.href = '/login';
      return;
    }
    const base =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
    window.location.href = `${base}/google-oauth/authorize?token=${encodeURIComponent(token)}&gbp=1`;
  };

  return (
    <div className={styles.layout}>
      <Head>
        <title>Connect GBP — NR SEO</title>
      </Head>
      <Sidebar />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div className={styles.pageHeader}>
            <Link
              href="/dashboard/gbp-optimization"
              className={styles.syncBtn}
              style={{ marginRight: 8 }}
            >
              <ArrowLeft size={14} /> Back
            </Link>
            <h1 className={styles.pageTitle}>Connect Google Business Profile</h1>
          </div>
          <p className={styles.pageSubtitle}>
            Grant NR SEO access to manage your Google Business Profiles,
            reviews, posts, and performance insights.
          </p>

          <div className={styles.connectCard}>
            <div className={styles.connectIcon}>
              <MapPin size={28} />
            </div>

            {isLoading ? (
              <p className={styles.connectText}>Checking connection…</p>
            ) : status?.hasGbpScope ? (
              <>
                <h2 className={styles.connectTitle}>
                  <CheckCircle2
                    size={20}
                    style={{ verticalAlign: 'middle', marginRight: 6, color: '#16a34a' }}
                  />
                  Connected
                </h2>
                <p className={styles.connectText}>
                  Your Google account is connected with Business Profile
                  access. You have {status.locationCount} synced location
                  {status.locationCount === 1 ? '' : 's'}.
                </p>
                <Link
                  href="/dashboard/gbp-optimization"
                  className={styles.primaryBtn}
                >
                  Go to dashboard
                </Link>
              </>
            ) : (
              <>
                <h2 className={styles.connectTitle}>Almost there</h2>
                <p className={styles.connectText}>
                  We&apos;ll redirect you to Google to approve Business
                  Profile management. You&apos;ll be able to:
                </p>
                <ul
                  style={{
                    textAlign: 'left',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.7,
                    margin: '0 auto 20px',
                    maxWidth: 420,
                  }}
                >
                  <li>Sync every location you own</li>
                  <li>Track profile views, calls, and directions</li>
                  <li>Reply to reviews with AI-assisted drafts</li>
                  <li>Create and schedule GBP posts</li>
                </ul>
                <button
                  className={styles.primaryBtn}
                  onClick={handleConnect}
                >
                  <Plug size={14} /> Continue with Google
                </button>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function GbpConnectPage() {
  return (
    <AuthGuard>
      <GbpConnectContent />
    </AuthGuard>
  );
}
