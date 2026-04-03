import Head from 'next/head';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth/AuthGuard';

function CancelledContent() {
  return (
    <>
      <Head>
        <title>Checkout Cancelled — NR SEO Platform</title>
      </Head>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-secondary)',
          padding: 24,
        }}
      >
        <div
          style={{
            textAlign: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '48px 40px',
            maxWidth: 440,
            width: '100%',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: 8,
            }}
          >
            Checkout cancelled
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'var(--text-secondary)',
              marginBottom: 32,
              lineHeight: 1.6,
            }}
          >
            No worries — you weren&apos;t charged. You can upgrade anytime from
            the billing page.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link
              href="/billing"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 42,
                padding: '0 24px',
                background: 'var(--accent-primary)',
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              View Plans
            </Link>
            <Link
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 42,
                padding: '0 24px',
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default function BillingCancelledPage() {
  return (
    <AuthGuard>
      <CancelledContent />
    </AuthGuard>
  );
}
