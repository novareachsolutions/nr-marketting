import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { apiClient, showSuccessToast } from '@repo/shared-frontend';
import styles from './index.module.css';

const PLANS = [
  {
    key: 'FREE',
    name: 'Free',
    desc: 'Get started with basic SEO tools',
    monthly: 0,
    yearly: 0,
    features: [
      '1 project',
      '10 tracked keywords',
      '100 pages per audit',
      '10 keyword searches/day',
      '10 AI messages/month',
      '2 competitors per project',
    ],
  },
  {
    key: 'PRO',
    name: 'Pro',
    desc: 'For growing sites and freelancers',
    monthly: 49,
    yearly: 39,
    popular: true,
    features: [
      '5 projects',
      '100 tracked keywords',
      '10,000 pages per audit',
      '500 keyword searches/day',
      '200 AI messages/month',
      '5 competitors per project',
      '20 reports/month',
      '3 team members',
    ],
  },
  {
    key: 'AGENCY',
    name: 'Agency',
    desc: 'For agencies managing multiple clients',
    monthly: 199,
    yearly: 159,
    features: [
      '25 projects',
      '1,000 tracked keywords',
      '100,000 pages per audit',
      'Unlimited keyword searches',
      'Unlimited AI messages',
      '10 competitors per project',
      'Unlimited reports',
      '10 team members',
      'White-label reports',
    ],
  },
];

function BillingContent() {
  const { user } = useAuth();
  const [yearly, setYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleUpgrade = async (plan: string) => {
    setLoadingPlan(plan);
    try {
      const { data } = await apiClient.post('/billing/create-checkout-session', {
        plan,
        billingCycle: yearly ? 'YEARLY' : 'MONTHLY',
      });
      if (data.success && data.data.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to create checkout session';
      alert(msg);
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManage = async () => {
    try {
      const { data } = await apiClient.post('/billing/create-portal-session');
      if (data.success && data.data.portalUrl) {
        window.location.href = data.data.portalUrl;
      }
    } catch {
      alert('Failed to open billing portal');
    }
  };

  return (
    <>
      <Head>
        <title>Billing & Plans — NR SEO Platform</title>
      </Head>
      <Sidebar />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div className={styles.header}>
            <h1 className={styles.title}>Choose your plan</h1>
            <p className={styles.subtitle}>
              Scale your SEO toolkit as your business grows
            </p>
          </div>

          {/* Billing Cycle Toggle */}
          <div className={styles.cycleToggle}>
            <span className={!yearly ? styles.cycleLabelActive : styles.cycleLabel}>
              Monthly
            </span>
            <button
              className={styles.toggleSwitch}
              data-active={yearly}
              onClick={() => setYearly(!yearly)}
            >
              <span className={styles.toggleDot} />
            </button>
            <span className={yearly ? styles.cycleLabelActive : styles.cycleLabel}>
              Yearly
            </span>
            {yearly && <span className={styles.saveBadge}>Save 20%</span>}
          </div>

          {/* Plans */}
          <div className={styles.plansGrid}>
            {PLANS.map((plan) => {
              const isCurrent = user?.plan === plan.key;
              const price = yearly ? plan.yearly : plan.monthly;

              return (
                <div
                  key={plan.key}
                  className={`${styles.planCard} ${plan.popular ? styles.planPopular : ''}`}
                >
                  {plan.popular && (
                    <span className={styles.popularBadge}>Most Popular</span>
                  )}
                  <div className={styles.planName}>{plan.name}</div>
                  <div className={styles.planDesc}>{plan.desc}</div>
                  <div className={styles.price}>
                    <span className={styles.priceAmount}>
                      ${price}
                    </span>
                    <span className={styles.pricePeriod}>
                      {price > 0 ? '/mo' : ''}
                    </span>
                  </div>
                  {yearly && price > 0 && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-tertiary)',
                        marginTop: -16,
                        marginBottom: 20,
                      }}
                    >
                      ${price * 12}/year billed annually
                    </div>
                  )}
                  <div className={styles.features}>
                    {plan.features.map((f) => (
                      <div key={f} className={styles.feature}>
                        <span className={styles.featureCheck}>✓</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                  {isCurrent ? (
                    <button className={styles.currentBadge} disabled>
                      Current Plan
                    </button>
                  ) : plan.key === 'FREE' ? (
                    <button className={styles.planBtnSecondary} disabled>
                      Free Forever
                    </button>
                  ) : (
                    <button
                      className={styles.planBtnPrimary}
                      onClick={() => handleUpgrade(plan.key)}
                      disabled={loadingPlan === plan.key}
                    >
                      {loadingPlan === plan.key
                        ? 'Redirecting...'
                        : `Upgrade to ${plan.name}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Manage Subscription */}
          {user?.plan !== 'FREE' && (
            <div className={styles.manageSection}>
              <div className={styles.manageText}>
                <h3>Manage your subscription</h3>
                <p>Update payment method, change plans, view invoices, or cancel</p>
              </div>
              <button className={styles.manageBtn} onClick={handleManage}>
                Open Billing Portal
              </button>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default function BillingPage() {
  return (
    <AuthGuard>
      <BillingContent />
    </AuthGuard>
  );
}
