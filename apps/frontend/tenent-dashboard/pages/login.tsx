import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { InputField } from '@/components/ui/InputField';
import styles from '@/components/auth/AuthLayout.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show verified message from email verification redirect
  useEffect(() => {
    if (router.query.verified === 'true') {
      setSuccessMsg('Email verified successfully! You can now log in.');
    }
  }, [router.query]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Login failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return null;

  return (
    <>
      <Head>
        <title>Sign In — NR SEO Platform</title>
      </Head>
      <AuthLayout
        heading="Welcome back"
        subheading="Sign in to your account to continue"
      >
        {successMsg && (
          <div className={styles.alertSuccess}>{successMsg}</div>
        )}
        {error && <div className={styles.alertError}>{error}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <InputField
            label="Email address"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
          <InputField
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <div className={styles.forgotRow}>
            <Link href="/forgot-password" className={styles.inlineLink}>
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting}
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className={styles.footer}>
          Don&apos;t have an account?
          <Link href="/register" className={styles.footerLink}>
            Create one
          </Link>
        </div>
      </AuthLayout>
    </>
  );
}
