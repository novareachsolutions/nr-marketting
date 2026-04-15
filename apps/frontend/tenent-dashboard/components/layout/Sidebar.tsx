import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '../ui/ThemeToggle';
import {
  LayoutDashboard,
  Search,
  Globe,
  TrendingUp,
  FileText,
  BarChart3,
  GitCompareArrows,
  Link2,
  Network,
  ShieldAlert,
  CreditCard,
  Plug,
  Info,
  LogOut,
  ChevronDown,
  Settings,
  Target,
  ClipboardList,
  Compass,
  Key,
  Lightbulb,
  PenTool,
  ClipboardType,
} from 'lucide-react';
import { ReactNode } from 'react';

interface SidebarLink {
  href: string;
  icon: ReactNode;
  label: string;
  match?: string;
  badge?: number;
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
      .map((w: string) => w[0])
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
    { href: '/dashboard/keywords', icon: <Search size={18} />, label: 'Keyword Research', match: '/dashboard/keywords' },
    { href: '/dashboard/domain-overview', icon: <Globe size={18} />, label: 'Domain Overview', match: '/dashboard/domain-overview' },
    { href: '/dashboard/organic-rankings', icon: <TrendingUp size={18} />, label: 'Organic Rankings', match: '/dashboard/organic-rankings' },
    { href: '/dashboard/top-pages', icon: <FileText size={18} />, label: 'Top Pages', match: '/dashboard/top-pages' },
    { href: '/dashboard/compare-domains', icon: <BarChart3 size={18} />, label: 'Compare Domains', match: '/dashboard/compare-domains' },
    { href: '/dashboard/keyword-gap', icon: <GitCompareArrows size={18} />, label: 'Keyword Gap', match: '/dashboard/keyword-gap' },
    { href: '/dashboard/backlink-gap', icon: <Link2 size={18} />, label: 'Backlink Gap', match: '/dashboard/backlink-gap' },
    { href: '/dashboard/backlinks', icon: <Network size={18} />, label: 'Backlinks', match: '/dashboard/backlinks' },
    { href: '/dashboard/backlink-audit', icon: <ShieldAlert size={18} />, label: 'Backlink Audit', match: '/dashboard/backlink-audit' },
    { href: '/dashboard/topic-research', icon: <Lightbulb size={18} />, label: 'Topic Research', match: '/dashboard/topic-research' },
    { href: '/dashboard/content-template', icon: <ClipboardType size={18} />, label: 'SEO Content Template', match: '/dashboard/content-template' },
    { href: '/dashboard/writing-assistant', icon: <PenTool size={18} />, label: 'Writing Assistant', match: '/dashboard/writing-assistant' },
  ];

  const mainLinks: SidebarLink[] = [
    { href: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard', match: '/dashboard' },
    ...(!projectId ? seoToolLinks : []),
  ];

  const otherLinks: SidebarLink[] = [
    { href: '/billing', icon: <CreditCard size={18} />, label: 'Billing & Plans', match: '/billing' },
    { href: '/settings/integrations', icon: <Plug size={18} />, label: 'Integrations', match: '/settings' },
    { href: '/dashboard/about', icon: <Info size={18} />, label: 'About Platform', match: '/dashboard/about' },
  ];

  const projectLinks: SidebarLink[] = projectId
    ? [
        { href: `/dashboard/projects/${projectId}`, icon: <Compass size={18} />, label: 'Overview', match: `/dashboard/projects/${projectId}` },
        { href: `/dashboard/projects/${projectId}/keywords`, icon: <Key size={18} />, label: 'Keywords', match: `/dashboard/projects/${projectId}/keywords` },
        { href: `/dashboard/keywords?projectId=${projectId}`, icon: <Search size={18} />, label: 'Keyword Research', match: `/dashboard/keywords` },
        { href: `/dashboard/projects/${projectId}/position-tracking`, icon: <Target size={18} />, label: 'Position Tracking', match: `/dashboard/projects/${projectId}/position-tracking` },
        { href: `/dashboard/projects/${projectId}/audits`, icon: <ClipboardList size={18} />, label: 'Site Audit', match: `/dashboard/projects/${projectId}/audits` },
        { href: `/dashboard/projects/${projectId}/domain-overview`, icon: <Globe size={18} />, label: 'Domain Overview', match: `/dashboard/projects/${projectId}/domain-overview` },
        { href: `/dashboard/projects/${projectId}/organic-rankings`, icon: <TrendingUp size={18} />, label: 'Organic Rankings', match: `/dashboard/projects/${projectId}/organic-rankings` },
        { href: `/dashboard/projects/${projectId}/top-pages`, icon: <FileText size={18} />, label: 'Top Pages', match: `/dashboard/projects/${projectId}/top-pages` },
        { href: `/dashboard/projects/${projectId}/compare-domains`, icon: <BarChart3 size={18} />, label: 'Compare Domains', match: `/dashboard/projects/${projectId}/compare-domains` },
        { href: `/dashboard/projects/${projectId}/keyword-gap`, icon: <GitCompareArrows size={18} />, label: 'Keyword Gap', match: `/dashboard/projects/${projectId}/keyword-gap` },
        { href: `/dashboard/projects/${projectId}/backlink-gap`, icon: <Link2 size={18} />, label: 'Backlink Gap', match: `/dashboard/projects/${projectId}/backlink-gap` },
        { href: `/dashboard/backlinks?projectId=${projectId}`, icon: <Network size={18} />, label: 'Backlinks', match: `/dashboard/backlinks` },
        { href: `/dashboard/backlink-audit?projectId=${projectId}`, icon: <ShieldAlert size={18} />, label: 'Backlink Audit', match: `/dashboard/backlink-audit` },
        { href: `/dashboard/topic-research?projectId=${projectId}`, icon: <Lightbulb size={18} />, label: 'Topic Research', match: `/dashboard/topic-research` },
        { href: `/dashboard/content-template?projectId=${projectId}`, icon: <ClipboardType size={18} />, label: 'SEO Content Template', match: `/dashboard/content-template` },
        { href: `/dashboard/writing-assistant?projectId=${projectId}`, icon: <PenTool size={18} />, label: 'Writing Assistant', match: `/dashboard/writing-assistant` },
        { href: `/dashboard/projects/${projectId}/reports`, icon: <FileText size={18} />, label: 'Reports', match: `/dashboard/projects/${projectId}/reports` },
        { href: `/dashboard/projects/${projectId}/settings`, icon: <Settings size={18} />, label: 'Settings', match: `/dashboard/projects/${projectId}/settings` },
      ]
    : [];

  const isActive = (link: SidebarLink) => {
    if (!link.match) return false;
    if (link.match === '/dashboard') {
      return router.asPath === '/dashboard' || router.asPath === '/dashboard/';
    }
    return router.asPath.startsWith(link.match);
  };

  const renderLink = (link: SidebarLink) => (
    <Link
      key={link.href}
      href={link.href}
      className={`sidebar-link ${isActive(link) ? 'sidebar-link-active' : ''}`}
    >
      <span className="sidebar-link-icon">{link.icon}</span>
      {link.label}
      {link.badge !== undefined && link.badge > 0 && (
        <span className="sidebar-link-badge">{link.badge}</span>
      )}
    </Link>
  );

  return (
    <aside className="app-sidebar">
      {/* Logo */}
      <Link href="/dashboard" className="sidebar-logo">
        <div className="sidebar-logo-icon">N</div>
        <span className="sidebar-logo-text">
          NR SEO
          <small>Analytics Hub</small>
        </span>
      </Link>

      {/* Scrollable nav area */}
      <div className="sidebar-nav-scroll">
        {/* Main Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-nav-label">Main</div>
          {mainLinks.map(renderLink)}
        </nav>

        {/* Project Navigation */}
        {projectId && projectLinks.length > 0 && (
          <>
            <div className="sidebar-divider" />
            <nav className="sidebar-nav">
              <div className="sidebar-nav-label">Project</div>
              {projectLinks.map(renderLink)}
            </nav>
          </>
        )}

        {/* Other section */}
        <div className="sidebar-divider" />
        <nav className="sidebar-nav">
          <div className="sidebar-nav-label">Other</div>
          {otherLinks.map(renderLink)}
        </nav>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-details">
            <div className="sidebar-user-name">{user?.name || user?.email}</div>
            <div className="sidebar-user-plan">{user?.plan} Plan</div>
          </div>
          <ChevronDown size={14} className="sidebar-user-chevron" />
        </div>
        <ThemeToggle />
        <button className="sidebar-logout" onClick={handleLogout}>
          <LogOut size={13} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

// Backward-compatible export for pages using sidebarStyles.contentWithSidebar
export const sidebarStyles = {
  contentWithSidebar: 'sidebar-content',
};
