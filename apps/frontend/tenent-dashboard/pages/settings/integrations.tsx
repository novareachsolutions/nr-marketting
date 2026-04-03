import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { apiClient, showSuccessToast } from '@repo/shared-frontend';
import styles from './integrations.module.css';

interface GoogleConnectionStatus {
  connected: boolean;
  connection: {
    id: string;
    userId: string;
    scope: string;
    gaPropertyId: string | null;
    gscSiteUrl: string | null;
    connectedAt: string;
    updatedAt: string;
    tokenExpiry: string;
  } | null;
}

interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

interface GaProperty {
  name: string;
  displayName: string;
  propertyId: string;
}

function IntegrationsContent() {
  const router = useRouter();
  const { user } = useAuth();

  const [status, setStatus] = useState<GoogleConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [gscSites, setGscSites] = useState<GscSite[]>([]);
  const [gaProperties, setGaProperties] = useState<GaProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  const [selectedGsc, setSelectedGsc] = useState('');
  const [selectedGa, setSelectedGa] = useState('');

  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<'success' | 'error'>('success');

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/google-oauth/status');
      if (data.success) {
        setStatus(data.data);
        if (data.data.connection) {
          setSelectedGsc(data.data.connection.gscSiteUrl || '');
          setSelectedGa(data.data.connection.gaPropertyId || '');
        }
      }
    } catch {
      // handled by apiClient interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProperties = useCallback(async () => {
    setLoadingProperties(true);
    try {
      const [gscRes, gaRes] = await Promise.all([
        apiClient.get('/google-oauth/search-console-sites'),
        apiClient.get('/google-oauth/analytics-properties'),
      ]);
      if (gscRes.data.success) setGscSites(gscRes.data.data);
      if (gaRes.data.success) setGaProperties(gaRes.data.data);
    } catch {
      // handled by interceptor
    } finally {
      setLoadingProperties(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (status?.connected) {
      fetchProperties();
    }
  }, [status?.connected, fetchProperties]);

  // Handle query params from OAuth callback redirect
  useEffect(() => {
    if (router.query.success === 'true') {
      setAlertMessage('Google account connected successfully.');
      setAlertType('success');
      // Clean up URL
      router.replace('/settings/integrations', undefined, { shallow: true });
      fetchStatus();
    } else if (router.query.error) {
      const errorMsg =
        router.query.error === 'missing_params'
          ? 'Missing parameters in Google callback.'
          : router.query.error === 'callback_failed'
            ? 'Failed to connect Google account. Please try again.'
            : `Google OAuth error: ${router.query.error}`;
      setAlertMessage(errorMsg);
      setAlertType('error');
      router.replace('/settings/integrations', undefined, { shallow: true });
    }
  }, [router.query.success, router.query.error, router, fetchStatus]);

  const handleConnect = () => {
    // Navigate to backend authorize endpoint — the JWT cookie is sent automatically
    // But since we use Bearer tokens, we need to pass the token via a redirect trick
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setAlertMessage('You must be logged in to connect Google.');
      setAlertType('error');
      return;
    }
    // Open the authorize URL. The backend expects JWT auth, so we open a new window
    // that first sets the auth then redirects. Simpler approach: directly redirect
    // and let the backend read the token from query param or use a temp session.
    // For simplicity, we'll call the API to get the redirect URL, then navigate.
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'}/google-oauth/authorize?token=${encodeURIComponent(token)}`;
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account?')) {
      return;
    }
    setDisconnecting(true);
    try {
      await apiClient.delete('/google-oauth/disconnect');
      setStatus({ connected: false, connection: null });
      setGscSites([]);
      setGaProperties([]);
      setSelectedGsc('');
      setSelectedGa('');
      showSuccessToast('Disconnected', 'Google account disconnected.');
    } catch {
      // handled by interceptor
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveProperties = async () => {
    setSaving(true);
    try {
      await apiClient.post('/google-oauth/select-properties', {
        gaPropertyId: selectedGa || null,
        gscSiteUrl: selectedGsc || null,
      });
      showSuccessToast('Saved', 'Selected properties updated.');
      fetchStatus();
    } catch {
      // handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const connectedAt = status?.connection?.connectedAt
    ? new Date(status.connection.connectedAt).toLocaleDateString()
    : null;

  return (
    <>
      <Head>
        <title>Integrations — NR SEO Platform</title>
      </Head>
      <Sidebar />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div className={styles.header}>
            <h1 className={styles.title}>Integrations</h1>
            <p className={styles.subtitle}>
              Connect your Google account to pull Search Console and Analytics
              data
            </p>
          </div>

          {alertMessage && (
            <div
              className={
                alertType === 'success' ? styles.alertSuccess : styles.alertError
              }
            >
              {alertMessage}
            </div>
          )}

          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderLeft}>
                  <div className={styles.googleIcon}>G</div>
                  <div>
                    <div className={styles.cardTitle}>Google Account</div>
                    <div className={styles.cardDesc}>
                      Search Console &amp; Analytics
                    </div>
                  </div>
                </div>
                {status?.connected ? (
                  <span className={styles.statusConnected}>
                    <span className={styles.statusDotGreen} />
                    Connected
                  </span>
                ) : (
                  <span className={styles.statusDisconnected}>
                    <span className={styles.statusDotGray} />
                    Not connected
                  </span>
                )}
              </div>

              {!status?.connected ? (
                <button className={styles.connectBtn} onClick={handleConnect}>
                  Connect Google Account
                </button>
              ) : (
                <>
                  {/* Property selection */}
                  <div className={styles.propertiesSection}>
                    <div className={styles.propertiesSectionTitle}>
                      Select Properties
                    </div>

                    {loadingProperties ? (
                      <div className={styles.loading}>
                        Loading properties...
                      </div>
                    ) : (
                      <>
                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>
                            Search Console Site
                          </label>
                          <select
                            className={styles.select}
                            value={selectedGsc}
                            onChange={(e) => setSelectedGsc(e.target.value)}
                          >
                            <option value="">-- Select a site --</option>
                            {gscSites.map((site) => (
                              <option key={site.siteUrl} value={site.siteUrl}>
                                {site.siteUrl}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>
                            Google Analytics Property
                          </label>
                          <select
                            className={styles.select}
                            value={selectedGa}
                            onChange={(e) => setSelectedGa(e.target.value)}
                          >
                            <option value="">-- Select a property --</option>
                            {gaProperties.map((prop) => (
                              <option
                                key={prop.propertyId}
                                value={prop.propertyId}
                              >
                                {prop.displayName} ({prop.propertyId})
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          className={styles.saveBtn}
                          onClick={handleSaveProperties}
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : 'Save Selection'}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Disconnect */}
                  <div className={styles.actionsRow}>
                    <span className={styles.connectedInfo}>
                      Connected on {connectedAt}
                    </span>
                    <button
                      className={styles.disconnectBtn}
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                    >
                      {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default function IntegrationsPage() {
  return (
    <AuthGuard>
      <IntegrationsContent />
    </AuthGuard>
  );
}
