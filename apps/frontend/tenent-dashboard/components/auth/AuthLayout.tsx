import { ReactNode } from 'react';
import { ThemeToggle } from '../ui/ThemeToggle';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  children: ReactNode;
  heading: string;
  subheading: string;
}

export function AuthLayout({ children, heading, subheading }: AuthLayoutProps) {
  return (
    <div className={styles.wrapper}>
      {/* ─── Left: Brand Panel ─── */}
      <div className={styles.brandPanel}>
        <div className={styles.brandOverlay} />
        <div className={styles.brandContent}>
          <div className={styles.brandLogo}>
            <div className={styles.logoIcon}>N</div>
            <span className={styles.logoText}>NR SEO Platform</span>
          </div>
          <h1 className={styles.brandTitle}>
            Your all-in-one SEO command center
          </h1>
          <p className={styles.brandDesc}>
            Track rankings, audit sites, research keywords, and get AI-powered
            insights — everything you need to dominate search results.
          </p>
          <div className={styles.features}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>📊</div>
              <span>Real-time rank tracking across devices</span>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>🔍</div>
              <span>Deep keyword research with volume & difficulty</span>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>🛠</div>
              <span>Comprehensive site audits with fix suggestions</span>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>🤖</div>
              <span>AI assistant for content & strategy</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right: Form Panel ─── */}
      <div className={styles.formPanel}>
        <div className={styles.topBar}>
          <ThemeToggle />
        </div>
        <div className={styles.formContainer}>
          <h2 className={styles.heading}>{heading}</h2>
          <p className={styles.subheading}>{subheading}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
