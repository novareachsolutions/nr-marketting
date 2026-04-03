import { useState, FormEvent } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { InputField } from '@/components/ui/InputField';
import styles from '@/components/auth/AuthLayout.module.css';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const msg = await forgotPassword(email);
      setSuccess(msg);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Request failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Forgot Password — NR SEO Platform</title>
      </Head>
      <AuthLayout
        heading="Forgot your password?"
        subheading="Enter your email and we'll send you a link to reset it"
      >
        {success && <div className={styles.alertSuccess}>{success}</div>}
        {error && <div className={styles.alertError}>{error}</div>}

        {!success && (
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
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              {submitting ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <div className={styles.footer}>
          Remember your password?
          <Link href="/login" className={styles.footerLink}>
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    </>
  );
}
