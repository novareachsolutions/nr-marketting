import { ReactNode } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import styles from '@/styles/Dashboard.module.css';

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <div className={styles.logoIcon}>N</div>
          <div className={styles.logoText}>NR Super Admin</div>
        </div>

        <nav className={styles.nav}>
          <a className={`${styles.navItem} ${styles.navItemActive}`}>
            User approvals
          </a>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarUserName}>
            {user?.name || 'Super admin'}
          </div>
          <div className={styles.sidebarUserEmail}>{user?.email}</div>
          <button className={styles.sidebarLogout} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
