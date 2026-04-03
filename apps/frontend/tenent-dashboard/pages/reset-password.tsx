import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { InputField } from '@/components/ui/InputField';
import styles from '@/components/auth/AuthLayout.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const token = (router.query.token as string) || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }

    setSubmitting(true);
    try {
      const msg = await resetPassword(token, password);
      setSuccess(msg);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Reset failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Reset Password — NR SEO Platform</title>
      </Head>
      <AuthLayout
        heading="Set a new password"
        subheading="Choose a strong password for your account"
      >
        {success && (
          <div className={styles.alertSuccess}>
            {success}{' '}
            <Link href="/login" className={styles.inlineLink}>
              Sign in now
            </Link>
          </div>
        )}
        {error && <div className={styles.alertError}>{error}</div>}

        {!success && (
          <form className={styles.form} onSubmit={handleSubmit}>
            <InputField
              label="New password"
              type="password"
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              autoFocus
              error={fieldErrors.password}
            />
            <InputField
              label="Confirm new password"
              type="password"
              placeholder="Re-enter your new password"
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
              {submitting ? 'Resetting...' : 'Reset password'}
            </button>
          </form>
        )}

        <div className={styles.footer}>
          <Link href="/login" className={styles.footerLink}>
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    </>
  );
}
