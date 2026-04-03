import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { InputField } from '@/components/ui/InputField';
import styles from '@/components/auth/AuthLayout.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(password)) {
      errors.password = 'Password must contain an uppercase letter';
    } else if (!/[a-z]/.test(password)) {
      errors.password = 'Password must contain a lowercase letter';
    } else if (!/\d/.test(password)) {
      errors.password = 'Password must contain a number';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validate()) return;

    setSubmitting(true);
    try {
      const msg = await register(email, password, name || undefined);
      setSuccess(msg);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Registration failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return null;

  return (
    <>
      <Head>
        <title>Create Account — NR SEO Platform</title>
      </Head>
      <AuthLayout
        heading="Create your account"
        subheading="Start optimizing your search presence today"
      >
        {success && <div className={styles.alertSuccess}>{success}</div>}
        {error && <div className={styles.alertError}>{error}</div>}

        {!success && (
          <form className={styles.form} onSubmit={handleSubmit}>
            <InputField
              label="Full name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              autoFocus
            />
            <InputField
              label="Email address"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <InputField
              label="Password"
              type="password"
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              error={fieldErrors.password}
            />
            <InputField
              label="Confirm password"
              type="password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              error={fieldErrors.confirmPassword}
            />
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              {submitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        )}

        <div className={styles.footer}>
          Already have an account?
          <Link href="/login" className={styles.footerLink}>
            Sign in
          </Link>
        </div>
      </AuthLayout>
    </>
  );
}
