import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { useProjects, useProject } from '@/hooks/useProjects';
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
  MapPin,
  FolderKanban,
} from 'lucide-react';
import { ReactNode } from 'react';

interface SidebarLink {
  href: string;
  icon: ReactNode;
  label: string;
  match?: string;
  exact?: boolean;
  badge?: number;
}

interface SidebarGroup {
  label?: string;
  links: SidebarLink[];
}

interface SidebarProps {
  projectId?: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: currentProject } = useProject(projectId || '');

  const hasProjects = (projects?.length ?? 0) > 0;

  // Hide the sidebar entirely until the user has at least one project.
  // Project pages bypass this since reaching them implies a project exists.
  if (!projectId && !projectsLoading && !hasProjects) {
    return null;
  }

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

  const mainGroup: SidebarGroup = {
    label: 'Main',
    links: [
      { href: '/dashboard', icon: <LayoutDashboard size={17} />, label: 'Dashboard', match: '/dashboard', exact: true },
    ],
  };

  const seoToolGroups: SidebarGroup[] = [
    {
      label: 'Keywords',
      links: [
        { href: '/dashboard/keywords', icon: <Search size={17} />, label: 'Keyword Research', match: '/dashboard/keywords' },
        { href: '/dashboard/keyword-gap', icon: <GitCompareArrows size={17} />, label: 'Keyword Gap', match: '/dashboard/keyword-gap' },
        { href: '/dashboard/topic-research', icon: <Lightbulb size={17} />, label: 'Topic Research', match: '/dashboard/topic-research' },
      ],
    },
    {
      label: 'Site & Rankings',
      links: [
        { href: '/dashboard/domain-overview', icon: <Globe size={17} />, label: 'Domain Overview', match: '/dashboard/domain-overview' },
        { href: '/dashboard/organic-rankings', icon: <TrendingUp size={17} />, label: 'Organic Rankings', match: '/dashboard/organic-rankings' },
        { href: '/dashboard/top-pages', icon: <FileText size={17} />, label: 'Top Pages', match: '/dashboard/top-pages' },
        { href: '/dashboard/compare-domains', icon: <BarChart3 size={17} />, label: 'Compare Domains', match: '/dashboard/compare-domains' },
      ],
    },
    {
      label: 'Backlinks',
      links: [
        { href: '/dashboard/backlinks', icon: <Network size={17} />, label: 'Backlinks', match: '/dashboard/backlinks' },
        { href: '/dashboard/backlink-audit', icon: <ShieldAlert size={17} />, label: 'Backlink Audit', match: '/dashboard/backlink-audit' },
        { href: '/dashboard/backlink-gap', icon: <Link2 size={17} />, label: 'Backlink Gap', match: '/dashboard/backlink-gap' },
      ],
    },
    {
      label: 'Content',
      links: [
        { href: '/dashboard/content-template', icon: <ClipboardType size={17} />, label: 'SEO Content Template', match: '/dashboard/content-template' },
        { href: '/dashboard/writing-assistant', icon: <PenTool size={17} />, label: 'Writing Assistant', match: '/dashboard/writing-assistant' },
      ],
    },
    {
      label: 'Local',
      links: [
        { href: '/dashboard/gbp-optimization', icon: <MapPin size={17} />, label: 'GBP Optimization', match: '/dashboard/gbp-optimization' },
      ],
    },
  ];

  const otherGroup: SidebarGroup = {
    label: 'Account',
    links: [
      { href: '/billing', icon: <CreditCard size={17} />, label: 'Billing & Plans', match: '/billing' },
      { href: '/settings/integrations', icon: <Plug size={17} />, label: 'Integrations', match: '/settings' },
      { href: '/dashboard/about', icon: <Info size={17} />, label: 'About', match: '/dashboard/about' },
    ],
  };

  const projectGroups: SidebarGroup[] = projectId
    ? [
        {
          label: 'Project',
          links: [
            { href: `/dashboard/projects/${projectId}`, icon: <Compass size={17} />, label: 'Overview', match: `/dashboard/projects/${projectId}`, exact: true },
          ],
        },
        {
          label: 'Keywords',
          links: [
            { href: `/dashboard/projects/${projectId}/keywords`, icon: <Key size={17} />, label: 'Keywords', match: `/dashboard/projects/${projectId}/keywords` },
            { href: `/dashboard/keywords?projectId=${projectId}`, icon: <Search size={17} />, label: 'Keyword Research', match: `/dashboard/keywords` },
            { href: `/dashboard/projects/${projectId}/position-tracking`, icon: <Target size={17} />, label: 'Position Tracking', match: `/dashboard/projects/${projectId}/position-tracking` },
            { href: `/dashboard/projects/${projectId}/keyword-gap`, icon: <GitCompareArrows size={17} />, label: 'Keyword Gap', match: `/dashboard/projects/${projectId}/keyword-gap` },
            { href: `/dashboard/topic-research?projectId=${projectId}`, icon: <Lightbulb size={17} />, label: 'Topic Research', match: `/dashboard/topic-research` },
          ],
        },
        {
          label: 'Site & Rankings',
          links: [
            { href: `/dashboard/projects/${projectId}/audits`, icon: <ClipboardList size={17} />, label: 'Site Audit', match: `/dashboard/projects/${projectId}/audits` },
            { href: `/dashboard/projects/${projectId}/domain-overview`, icon: <Globe size={17} />, label: 'Domain Overview', match: `/dashboard/projects/${projectId}/domain-overview` },
            { href: `/dashboard/projects/${projectId}/organic-rankings`, icon: <TrendingUp size={17} />, label: 'Organic Rankings', match: `/dashboard/projects/${projectId}/organic-rankings` },
            { href: `/dashboard/projects/${projectId}/top-pages`, icon: <FileText size={17} />, label: 'Top Pages', match: `/dashboard/projects/${projectId}/top-pages` },
            { href: `/dashboard/projects/${projectId}/compare-domains`, icon: <BarChart3 size={17} />, label: 'Compare Domains', match: `/dashboard/projects/${projectId}/compare-domains` },
          ],
        },
        {
          label: 'Backlinks',
          links: [
            { href: `/dashboard/backlinks?projectId=${projectId}`, icon: <Network size={17} />, label: 'Backlinks', match: `/dashboard/backlinks` },
            { href: `/dashboard/backlink-audit?projectId=${projectId}`, icon: <ShieldAlert size={17} />, label: 'Backlink Audit', match: `/dashboard/backlink-audit` },
            { href: `/dashboard/projects/${projectId}/backlink-gap`, icon: <Link2 size={17} />, label: 'Backlink Gap', match: `/dashboard/projects/${projectId}/backlink-gap` },
          ],
        },
        {
          label: 'Content',
          links: [
            { href: `/dashboard/content-template?projectId=${projectId}`, icon: <ClipboardType size={17} />, label: 'SEO Content Template', match: `/dashboard/content-template` },
            { href: `/dashboard/writing-assistant?projectId=${projectId}`, icon: <PenTool size={17} />, label: 'Writing Assistant', match: `/dashboard/writing-assistant` },
          ],
        },
        {
          label: 'Reports & Settings',
          links: [
            { href: `/dashboard/projects/${projectId}/reports`, icon: <FileText size={17} />, label: 'Reports', match: `/dashboard/projects/${projectId}/reports` },
            { href: `/dashboard/projects/${projectId}/settings`, icon: <Settings size={17} />, label: 'Settings', match: `/dashboard/projects/${projectId}/settings` },
          ],
        },
      ]
    : [];

  // Strip query string for path-only matching against link.match.
  const currentPath = router.asPath.split('?')[0];

  const isActive = (link: SidebarLink) => {
    if (!link.match) return false;
    const matchPath = link.match.split('?')[0];
    if (link.exact) {
      return currentPath === matchPath || currentPath === `${matchPath}/`;
    }
    return currentPath === matchPath || currentPath.startsWith(`${matchPath}/`);
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

  const renderGroup = (group: SidebarGroup, key: string | number) => (
    <nav key={key} className="sidebar-nav">
      {group.label && <div className="sidebar-nav-label">{group.label}</div>}
      {group.links.map(renderLink)}
    </nav>
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

      {/* Current project indicator */}
      {projectId && currentProject && (
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="sidebar-current-project"
          title={`${currentProject.name} (${currentProject.domain})`}
        >
          <div className="sidebar-current-project-icon">
            <FolderKanban size={16} />
          </div>
          <div className="sidebar-current-project-meta">
            <div className="sidebar-current-project-label">Current Project</div>
            <div className="sidebar-current-project-name">{currentProject.name}</div>
            <div className="sidebar-current-project-domain">{currentProject.domain}</div>
          </div>
        </Link>
      )}

      {/* Scrollable nav area */}
      <div className="sidebar-nav-scroll">
        {renderGroup(mainGroup, 'main')}

        {projectId ? (
          <>
            <div className="sidebar-divider" />
            {projectGroups.map((g, i) => renderGroup(g, `project-${i}`))}
          </>
        ) : (
          <>
            <div className="sidebar-divider" />
            {seoToolGroups.map((g, i) => renderGroup(g, `tools-${i}`))}
          </>
        )}

        <div className="sidebar-divider" />
        {renderGroup(otherGroup, 'account')}
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
