import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProject } from '@/hooks/useProjects';
import { apiClient, showSuccessToast } from '@repo/shared-frontend';
import styles from './settings.module.css';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MODULE_LABELS: Record<string, string> = {
  siteAudit: 'Site Audit',
  domainOverview: 'Domain Overview',
  organicRankings: 'Organic Rankings',
  positionTracking: 'Position Tracking',
  topPages: 'Top Pages',
  keywords: 'Keywords',
};

function formatHour(h: number) {
  if (h === 0) return '12:00 AM';
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

function SettingsContent() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const { data: project, isLoading, refetch } = useProject(id);

  // WordPress state
  const [wpSiteUrl, setWpSiteUrl] = useState('');
  const [wpUsername, setWpUsername] = useState('');
  const [wpAppPassword, setWpAppPassword] = useState('');
  const [wpConnecting, setWpConnecting] = useState(false);
  const [wpError, setWpError] = useState('');
  const [wpStatus, setWpStatus] = useState<any>(null);
  const [wpLoaded, setWpLoaded] = useState(false);

  // GitHub state
  const [ghRepos, setGhRepos] = useState<any[]>([]);
  const [ghSelectedRepo, setGhSelectedRepo] = useState('');
  const [ghAccessToken, setGhAccessToken] = useState('');
  const [ghConnecting, setGhConnecting] = useState(false);
  const [ghError, setGhError] = useState('');
  const [ghStatus, setGhStatus] = useState<any>(null);
  const [ghLoaded, setGhLoaded] = useState(false);

  // Report schedule state
  const [reportSchedule, setReportSchedule] = useState('NONE');
  const [reportDay, setReportDay] = useState(0);
  const [reportHour, setReportHour] = useState(2);
  const [reportModules, setReportModules] = useState<string[]>([]);
  const [availableModules, setAvailableModules] = useState<Record<string, boolean>>({});
  const [reportNextAt, setReportNextAt] = useState<string | null>(null);
  const [reportLastAt, setReportLastAt] = useState<string | null>(null);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportLoaded, setReportLoaded] = useState(false);

  // Load connection statuses
  const loadWpStatus = async () => {
    try {
      const { data } = await apiClient.get(`/projects/${id}/wordpress/status`);
      if (data.success) setWpStatus(data.data);
    } catch { setWpStatus(null); }
    setWpLoaded(true);
  };

  const loadGhStatus = async () => {
    try {
      const { data } = await apiClient.get(`/projects/${id}/github/status`);
      if (data.success) setGhStatus(data.data);
    } catch { setGhStatus(null); }
    setGhLoaded(true);
  };

  if (!wpLoaded && id) loadWpStatus();
  if (!ghLoaded && id) loadGhStatus();

  // Check for GitHub callback token in URL
  const ghTokenFromUrl = router.query.ghToken as string;
  if (ghTokenFromUrl && !ghAccessToken) {
    setGhAccessToken(ghTokenFromUrl);
    // Load repos with this token
    apiClient
      .get(`/projects/${id}/github/repos?accessToken=${ghTokenFromUrl}`)
      .then(({ data }) => {
        if (data.success) setGhRepos(data.data);
      })
      .catch(() => {});
  }

  // ─── WordPress Connect ─────────────────────────────────
  const handleWpConnect = async (e: FormEvent) => {
    e.preventDefault();
    setWpError('');
    setWpConnecting(true);
    try {
      await apiClient.post(`/projects/${id}/wordpress/connect`, {
        siteUrl: wpSiteUrl,
        username: wpUsername,
        appPassword: wpAppPassword,
        authMethod: 'APP_PASSWORD',
      });
      showSuccessToast('Connected', 'WordPress connected successfully');
      setWpLoaded(false);
      refetch();
    } catch (err: any) {
      setWpError(err?.response?.data?.message || err?.message || 'Connection failed');
    } finally {
      setWpConnecting(false);
    }
  };

  const handleWpDisconnect = async () => {
    if (!confirm('Disconnect WordPress? Auto-fix via WP API will stop working.')) return;
    try {
      await apiClient.delete(`/projects/${id}/wordpress/disconnect`);
      showSuccessToast('Disconnected', 'WordPress disconnected');
      setWpStatus(null);
      refetch();
    } catch {}
  };

  // ─── GitHub Connect ────────────────────────────────────
  const handleGhAuthorize = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'}/github/authorize?projectId=${id}&token=${localStorage.getItem('accessToken')}`;
  };

  const handleGhConnect = async () => {
    if (!ghSelectedRepo || !ghAccessToken) return;
    setGhError('');
    setGhConnecting(true);
    try {
      await apiClient.post(`/projects/${id}/github/connect`, {
        accessToken: ghAccessToken,
        repoFullName: ghSelectedRepo,
      });
      showSuccessToast('Connected', 'GitHub repository connected');
      setGhLoaded(false);
      setGhRepos([]);
      setGhAccessToken('');
      refetch();
    } catch (err: any) {
      setGhError(err?.response?.data?.message || err?.message || 'Connection failed');
    } finally {
      setGhConnecting(false);
    }
  };

  const handleGhDisconnect = async () => {
    if (!confirm('Disconnect GitHub? Auto-fix PRs will stop working.')) return;
    try {
      await apiClient.delete(`/projects/${id}/github/disconnect`);
      showSuccessToast('Disconnected', 'GitHub disconnected');
      setGhStatus(null);
      refetch();
    } catch {}
  };

  // Load report settings
  useEffect(() => {
    if (!id || reportLoaded) return;
    apiClient
      .get(`/projects/${id}/reports/settings`)
      .then(({ data }) => {
        if (data.success) {
          const d = data.data;
          setReportSchedule(d.reportSchedule || 'NONE');
          setReportDay(d.reportDay ?? 0);
          setReportHour(d.reportHour ?? 2);
          setReportModules(d.reportModules || []);
          setAvailableModules(d.availableModules || {});
          setReportNextAt(d.nextReportAt);
          setReportLastAt(d.lastWeeklyReportAt);
        }
      })
      .catch(() => {})
      .finally(() => setReportLoaded(true));
  }, [id, reportLoaded]);

  const handleReportModuleToggle = (mod: string) => {
    setReportModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  };

  const handleSaveReportSettings = async () => {
    setReportError('');
    setReportSaving(true);
    try {
      const { data } = await apiClient.put(`/projects/${id}/reports/settings`, {
        reportSchedule,
        reportDay: reportSchedule === 'WEEKLY' ? reportDay : null,
        reportHour,
        reportModules,
      });
      if (data.success) {
        setReportNextAt(data.data.nextReportAt);
        showSuccessToast('Saved', 'Report schedule updated');
      }
    } catch (err: any) {
      setReportError(err?.response?.data?.message || 'Failed to save settings');
    } finally {
      setReportSaving(false);
    }
  };

  const handleGenerateNow = async () => {
    setReportError('');
    setReportGenerating(true);
    try {
      const selectedModules = reportModules.length > 0 ? reportModules : undefined;
      await apiClient.post(`/projects/${id}/reports/generate`, {
        modules: selectedModules,
      });
      showSuccessToast('Started', 'Report generation started. Check Reports page shortly.');
    } catch (err: any) {
      setReportError(err?.response?.data?.message || 'Failed to generate report');
    } finally {
      setReportGenerating(false);
    }
  };

  if (isLoading || !project) return <div className={styles.loading}>Loading...</div>;

  return (
    <>
      <Head><title>Settings — {project.name} — NR SEO Platform</title></Head>
      <Sidebar projectId={id} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <h1 className={styles.title}>Project Settings</h1>

          {/* ─── WordPress Section ─── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>WordPress Connection</span>
              <span className={`${styles.statusBadge} ${wpStatus ? styles.connected : styles.disconnected}`}>
                {wpStatus ? 'Connected' : 'Not connected'}
              </span>
            </div>
            <div className={styles.sectionBody}>
              {wpStatus ? (
                <>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Site URL</span>
                      <span className={styles.infoValue}>{wpStatus.siteUrl}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>WP Version</span>
                      <span className={styles.infoValue}>{wpStatus.wpVersion || '—'}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>SEO Plugin</span>
                      <span className={styles.infoValue}>{wpStatus.seoPlugin || 'None'}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Status</span>
                      <span className={styles.infoValue}>{wpStatus.isValid ? 'Valid' : 'Invalid'}</span>
                    </div>
                  </div>
                  <button className={styles.disconnectBtn} onClick={handleWpDisconnect}>
                    Disconnect WordPress
                  </button>
                </>
              ) : (
                <form className={styles.form} onSubmit={handleWpConnect}>
                  {wpError && <div className={styles.alertError}>{wpError}</div>}
                  <div className={styles.formRow}>
                    <label className={styles.formLabel}>WordPress Site URL</label>
                    <input className={styles.formInput} placeholder="https://mysite.com" value={wpSiteUrl} onChange={e => setWpSiteUrl(e.target.value)} required />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel}>Username</label>
                    <input className={styles.formInput} placeholder="admin" value={wpUsername} onChange={e => setWpUsername(e.target.value)} required />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel}>Application Password</label>
                    <input className={styles.formInput} type="password" placeholder="xxxx xxxx xxxx xxxx" value={wpAppPassword} onChange={e => setWpAppPassword(e.target.value)} required />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                    Go to WordPress Admin → Users → Profile → Application Passwords to generate one.
                  </p>
                  <div className={styles.btnRow}>
                    <button type="submit" className={styles.connectBtn} disabled={wpConnecting}>
                      {wpConnecting ? 'Connecting...' : 'Connect WordPress'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* ─── GitHub Section ─── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>GitHub Connection</span>
              <span className={`${styles.statusBadge} ${ghStatus ? styles.connected : styles.disconnected}`}>
                {ghStatus ? 'Connected' : 'Not connected'}
              </span>
            </div>
            <div className={styles.sectionBody}>
              {ghStatus ? (
                <>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Repository</span>
                      <span className={styles.infoValue}>{ghStatus.repoFullName}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Branch</span>
                      <span className={styles.infoValue}>{ghStatus.defaultBranch}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Deploy URL</span>
                      <span className={styles.infoValue}>{ghStatus.deployUrl || '—'}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Status</span>
                      <span className={styles.infoValue}>{ghStatus.isValid ? 'Valid' : 'Invalid'}</span>
                    </div>
                  </div>
                  <button className={styles.disconnectBtn} onClick={handleGhDisconnect}>
                    Disconnect GitHub
                  </button>
                </>
              ) : ghRepos.length > 0 ? (
                <>
                  {ghError && <div className={styles.alertError}>{ghError}</div>}
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    Select a repository to connect:
                  </p>
                  <div className={styles.repoList}>
                    {ghRepos.map((repo: any) => (
                      <div
                        key={repo.fullName}
                        className={ghSelectedRepo === repo.fullName ? styles.repoItemSelected : styles.repoItem}
                        onClick={() => setGhSelectedRepo(repo.fullName)}
                      >
                        <div>
                          <div className={styles.repoName}>{repo.fullName}</div>
                          <div className={styles.repoBranch}>{repo.defaultBranch}</div>
                        </div>
                        {repo.private && <span className={styles.repoPrivate}>Private</span>}
                      </div>
                    ))}
                  </div>
                  <div className={styles.btnRow} style={{ marginTop: 12 }}>
                    <button
                      className={styles.connectBtn}
                      onClick={handleGhConnect}
                      disabled={!ghSelectedRepo || ghConnecting}
                    >
                      {ghConnecting ? 'Connecting...' : 'Connect Repository'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {ghError && <div className={styles.alertError}>{ghError}</div>}
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    Connect your GitHub account to enable auto-fix via Pull Requests.
                  </p>
                  <button className={styles.connectBtn} onClick={handleGhAuthorize}>
                    Connect GitHub
                  </button>
                </>
              )}
            </div>
          </div>
          {/* ─── Automated SEO Reports Section ─── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Automated SEO Reports</span>
              <span className={`${styles.statusBadge} ${reportSchedule !== 'NONE' ? styles.connected : styles.disconnected}`}>
                {reportSchedule !== 'NONE' ? `${reportSchedule}` : 'Off'}
              </span>
            </div>
            <div className={styles.sectionBody}>
              {reportError && <div className={styles.alertError}>{reportError}</div>}

              <div className={styles.form}>
                {/* Schedule Toggle */}
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Frequency</label>
                  <select
                    className={styles.formSelect}
                    value={reportSchedule}
                    onChange={(e) => setReportSchedule(e.target.value)}
                  >
                    <option value="NONE">Off</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>

                {reportSchedule !== 'NONE' && (
                  <>
                    {/* Day of week (only for WEEKLY) */}
                    {reportSchedule === 'WEEKLY' && (
                      <div className={styles.formRow}>
                        <label className={styles.formLabel}>Day of Week</label>
                        <select
                          className={styles.formSelect}
                          value={reportDay}
                          onChange={(e) => setReportDay(Number(e.target.value))}
                        >
                          {DAYS_OF_WEEK.map((day, i) => (
                            <option key={i} value={i}>{day}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Hour */}
                    <div className={styles.formRow}>
                      <label className={styles.formLabel}>Time (UTC)</label>
                      <select
                        className={styles.formSelect}
                        value={reportHour}
                        onChange={(e) => setReportHour(Number(e.target.value))}
                      >
                        {HOURS.map((h) => (
                          <option key={h} value={h}>{formatHour(h)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Module Checkboxes */}
                    <div className={styles.formRow}>
                      <label className={styles.formLabel}>Modules to Include</label>
                      <div className={styles.moduleList}>
                        {Object.entries(MODULE_LABELS).map(([key, label]) => {
                          const isAvailable = availableModules[key] ?? false;
                          const isChecked = reportModules.includes(key);
                          return (
                            <label
                              key={key}
                              className={`${styles.moduleItem} ${!isAvailable ? styles.moduleDisabled : ''}`}
                              title={!isAvailable ? 'Run this module at least once to include it in reports' : ''}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={!isAvailable}
                                onChange={() => handleReportModuleToggle(key)}
                                className={styles.moduleCheckbox}
                              />
                              <span className={styles.moduleLabel}>{label}</span>
                              {!isAvailable && (
                                <span className={styles.moduleNoData}>No data</span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* Action buttons */}
                <div className={styles.btnRow}>
                  {reportSchedule !== 'NONE' && (
                    <button
                      className={styles.connectBtn}
                      onClick={handleSaveReportSettings}
                      disabled={reportSaving}
                    >
                      {reportSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                  )}
                  {reportSchedule === 'NONE' && (
                    <button
                      className={styles.connectBtn}
                      onClick={() => {
                        setReportSchedule('WEEKLY');
                      }}
                    >
                      Enable Reports
                    </button>
                  )}
                  <button
                    className={styles.generateBtn}
                    onClick={handleGenerateNow}
                    disabled={reportGenerating}
                  >
                    {reportGenerating ? 'Generating...' : 'Generate Now'}
                  </button>
                </div>

                {/* Next report info */}
                {reportSchedule !== 'NONE' && reportNextAt && (
                  <p className={styles.reportInfo}>
                    Next report: {new Date(reportNextAt).toLocaleString('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZoneName: 'short',
                    })}
                  </p>
                )}
                {reportLastAt && (
                  <p className={styles.reportInfo}>
                    Last report: {new Date(reportLastAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default function ProjectSettingsPage() {
  return <AuthGuard><SettingsContent /></AuthGuard>;
}
