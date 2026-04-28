import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isSuperAdmin, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!isSuperAdmin) {
      logout().finally(() => router.replace('/login'));
    }
  }, [isAuthenticated, isLoading, isSuperAdmin, logout, router]);

  if (isLoading || !isAuthenticated || !isSuperAdmin) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          color: '#6b7280',
          fontSize: 14,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
