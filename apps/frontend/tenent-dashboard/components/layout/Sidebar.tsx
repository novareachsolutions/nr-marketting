import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '../ui/ThemeToggle';
import styles from './Sidebar.module.css';

interface SidebarLink {
  href: string;
  icon: string;
  label: string;
  match?: string; // pathname prefix to match for active state
}

interface SidebarProps {
  projectId?: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const initials =
    user?.name
      ?.split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ||
    user?.email?.slice(0, 2).toUpperCase() ||
    '??';

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const seoToolLinks: SidebarLink[] = [
    { href: '/dashboard/keywords', icon: '🔍', label: 'Keyword Research', match: '/dashboard/keywords' },
    { href: '/dashboard/domain-overview', icon: '🌐', label: 'Domain Overview', match: '/dashboard/domain-overview' },
    { href: '/dashboard/organic-rankings', icon: '📈', label: 'Organic Rankings', match: '/dashboard/organic-rankings' },
    { href: '/dashboard/top-pages', icon: '📄', label: 'Top Pages', match: '/dashboard/top-pages' },
    { href: '/dashboard/compare-domains', icon: '⚖️', label: 'Compare Domains', match: '/dashboard/compare-domains' },
    { href: '/dashboard/keyword-gap', icon: '🔀', label: 'Keyword Gap', match: '/dashboard/keyword-gap' },
    { href: '/dashboard/backlink-gap', icon: '🔗', label: 'Backlink Gap', match: '/dashboard/backlink-gap' },
  ];

  const mainLinks: SidebarLink[] = [
    { href: '/dashboard', icon: '🏠', label: 'Dashboard', match: '/dashboard' },
    // Only show global SEO tools when NOT inside a project
    ...(!projectId ? seoToolLinks : []),
    { href: '/dashboard/about', icon: '💡', label: 'About Platform', match: '/dashboard/about' },
    { href: '/billing', icon: '💳', label: 'Billing & Plans', match: '/billing' },
    { href: '/settings/integrations', icon: '🔗', label: 'Integrations', match: '/settings' },
  ];

  const projectLinks: SidebarLink[] = projectId
    ? [
        {
          href: `/dashboard/projects/${projectId}`,
          icon: '📊',
          label: 'Overview',
          match: `/dashboard/projects/${projectId}`,
        },
        {
          href: `/dashboard/projects/${projectId}/keywords`,
          icon: '🔑',
          label: 'Keywords',
          match: `/dashboard/projects/${projectId}/keywords`,
        },
        {
          href: `/dashboard/projects/${projectId}/position-tracking`,
          icon: '📍',
          label: 'Position Tracking',
          match: `/dashboard/projects/${projectId}/position-tracking`,
        },
        {
          href: `/dashboard/projects/${projectId}/audits`,
          icon: '🛠',
          label: 'Site Audit',
          match: `/dashboard/projects/${projectId}/audits`,
        },
        {
          href: `/dashboard/projects/${projectId}/domain-overview`,
          icon: '🌐',
          label: 'Domain Overview',
          match: `/dashboard/projects/${projectId}/domain-overview`,
        },
        {
          href: `/dashboard/projects/${projectId}/organic-rankings`,
          icon: '📈',
          label: 'Organic Rankings',
          match: `/dashboard/projects/${projectId}/organic-rankings`,
        },
        {
          href: `/dashboard/projects/${projectId}/top-pages`,
          icon: '📄',
          label: 'Top Pages',
          match: `/dashboard/projects/${projectId}/top-pages`,
        },
        {
          href: `/dashboard/projects/${projectId}/compare-domains`,
          icon: '⚖️',
          label: 'Compare Domains',
          match: `/dashboard/projects/${projectId}/compare-domains`,
        },
        {
          href: `/dashboard/projects/${projectId}/keyword-gap`,
          icon: '🔀',
          label: 'Keyword Gap',
          match: `/dashboard/projects/${projectId}/keyword-gap`,
        },
        {
          href: `/dashboard/projects/${projectId}/backlink-gap`,
          icon: '🔗',
          label: 'Backlink Gap',
          match: `/dashboard/projects/${projectId}/backlink-gap`,
        },
        {
          href: `/dashboard/projects/${projectId}/settings`,
          icon: '⚙️',
          label: 'Settings',
          match: `/dashboard/projects/${projectId}/settings`,
        },
      ]
    : [];

  const isActive = (link: SidebarLink) => {
    if (!link.match) return false;
    // Exact match for dashboard home, prefix match for others
    if (link.match === '/dashboard') {
      return router.asPath === '/dashboard' || router.asPath === '/dashboard/';
    }
    return router.asPath.startsWith(link.match);
  };

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <Link href="/dashboard" className={styles.logo}>
        <div className={styles.logoIcon}>N</div>
        <span className={styles.logoText}>NR SEO</span>
      </Link>

      {/* Main Navigation */}
      <nav className={styles.navSection}>
        <div className={styles.navLabel}>Main</div>
        {mainLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={isActive(link) ? styles.navLinkActive : styles.navLink}
          >
            <span className={styles.navIcon}>{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Project Navigation */}
      {projectId && projectLinks.length > 0 && (
        <>
          <div className={styles.divider} />
          <nav className={styles.navSection}>
            <div className={styles.navLabel}>Project</div>
            {projectLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  isActive(link) ? styles.navLinkActive : styles.navLink
                }
              >
                <span className={styles.navIcon}>{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </nav>
        </>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.userDetails}>
            <div className={styles.userName}>{user?.name || user?.email}</div>
            <div className={styles.userPlan}>{user?.plan} Plan</div>
          </div>
          <ThemeToggle />
        </div>
        <div className={styles.footerActions}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}

export { styles as sidebarStyles };
