import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import {
  useGbpLocations,
  useGbpPosts,
  useCreateGbpPost,
  useGbpAiPostDraft,
  useDeleteGbpPost,
} from '@/hooks/useGbpOptimization';
import {
  ArrowLeft,
  FileText,
  Loader2,
  Sparkles,
  Send,
  Trash2,
  Calendar,
} from 'lucide-react';
import type { GbpPostType, GbpPostStatus } from '@/types/gbp-optimization';
import styles from './index.module.css';

const POST_TYPES: { value: GbpPostType; label: string }[] = [
  { value: 'UPDATE', label: 'Update' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'EVENT', label: 'Event' },
  { value: 'PRODUCT', label: 'Product' },
];

const CTA_TYPES = [
  { value: 'LEARN_MORE', label: 'Learn more' },
  { value: 'BOOK', label: 'Book' },
  { value: 'ORDER', label: 'Order online' },
  { value: 'SHOP', label: 'Shop' },
  { value: 'CALL', label: 'Call now' },
  { value: 'SIGN_UP', label: 'Sign up' },
];

function statusClass(status: GbpPostStatus) {
  switch (status) {
    case 'PUBLISHED':
      return styles.postStatusPublished;
    case 'SCHEDULED':
      return styles.postStatusScheduled;
    case 'FAILED':
      return styles.postStatusFailed;
    default:
      return styles.postStatusDraft;
  }
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function GbpPostsContent() {
  const router = useRouter();
  const { locationId: qLocationId } = router.query;
  const { data: locations = [] } = useGbpLocations();

  const activeId =
    (typeof qLocationId === 'string' && qLocationId) ||
    (locations[0]?.id ?? null);

  const { data, isLoading } = useGbpPosts(activeId, 1, 50);
  const createMutation = useCreateGbpPost();
  const aiMutation = useGbpAiPostDraft();
  const deleteMutation = useDeleteGbpPost();

  const [type, setType] = useState<GbpPostType>('UPDATE');
  const [content, setContent] = useState('');
  const [ctaType, setCtaType] = useState('LEARN_MORE');
  const [ctaUrl, setCtaUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [aiTopic, setAiTopic] = useState('');

  const handleAiDraft = async () => {
    if (!activeId) return;
    const res = await aiMutation.mutateAsync({
      locationId: activeId,
      type,
      topic: aiTopic || undefined,
    });
    setContent(res.content);
    if (res.ctaType) setCtaType(res.ctaType);
  };

  const handleCreate = async () => {
    if (!activeId || !content.trim()) return;
    await createMutation.mutateAsync({
      locationId: activeId,
      type,
      content: content.trim(),
      ctaType,
      ctaUrl: ctaUrl || undefined,
      scheduledAt: scheduledAt || undefined,
    });
    setContent('');
    setCtaUrl('');
    setScheduledAt('');
    setAiTopic('');
  };

  return (
    <div className={styles.layout}>
      <Head>
        <title>GBP Posts — NR SEO</title>
      </Head>
      <Sidebar />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div className={styles.pageHeader}>
            <Link
              href="/dashboard/gbp-optimization"
              className={styles.syncBtn}
              style={{ marginRight: 8 }}
            >
              <ArrowLeft size={14} /> Back
            </Link>
            <h1 className={styles.pageTitle}>Posts</h1>
          </div>
          <p className={styles.pageSubtitle}>
            Create and schedule engaging posts for your Google Business
            Profile. Use AI to draft in seconds.
          </p>

          {/* Create form */}
          <div className={styles.formCard}>
            <h3 className={styles.formTitle}>New post</h3>
            <div className={styles.formRow}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Type</label>
                <select
                  className={styles.formSelect}
                  value={type}
                  onChange={(e) => setType(e.target.value as GbpPostType)}
                >
                  {POST_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formField} style={{ flex: 2 }}>
                <label className={styles.formLabel}>AI topic (optional)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className={styles.formInput}
                    placeholder="e.g. Spring SEO promo, Local workshop on May 12"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                  />
                  <button
                    className={styles.syncBtn}
                    onClick={handleAiDraft}
                    disabled={aiMutation.isPending}
                  >
                    {aiMutation.isPending ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />{' '}
                        Drafting
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} /> AI draft
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.formField} style={{ marginBottom: 12 }}>
              <label className={styles.formLabel}>
                Content ({content.length}/1500)
              </label>
              <textarea
                className={styles.formTextarea}
                value={content}
                maxLength={1500}
                placeholder="Write your GBP post here…"
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Call-to-action</label>
                <select
                  className={styles.formSelect}
                  value={ctaType}
                  onChange={(e) => setCtaType(e.target.value)}
                >
                  {CTA_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formField} style={{ flex: 2 }}>
                <label className={styles.formLabel}>CTA URL</label>
                <input
                  className={styles.formInput}
                  placeholder="https://…"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Schedule</label>
                <input
                  className={styles.formInput}
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: 12 }}>
              <button
                className={styles.primaryBtn}
                onClick={handleCreate}
                disabled={!content.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />{' '}
                    {scheduledAt ? 'Scheduling' : 'Publishing'}
                  </>
                ) : (
                  <>
                    <Send size={12} />{' '}
                    {scheduledAt ? 'Schedule post' : 'Publish now'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* List */}
          {isLoading && (
            <div className={styles.loadingState}>
              <Loader2 size={16} className="animate-spin" /> Loading posts...
            </div>
          )}

          {data?.posts.map((post) => (
            <div key={post.id} className={styles.postCard}>
              <div className={styles.postHeader}>
                <span className={styles.postType}>{post.type}</span>
                <span
                  className={`${styles.postType} ${statusClass(post.status)}`}
                >
                  {post.status}
                </span>
                <div style={{ marginLeft: 'auto' }}>
                  <button
                    className={styles.syncBtn}
                    onClick={() => deleteMutation.mutate(post.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className={styles.postContent}>{post.content}</div>
              <div className={styles.postMeta}>
                {post.scheduledAt && (
                  <span>
                    <Calendar size={11} />{' '}
                    Scheduled: {formatDate(post.scheduledAt)}
                  </span>
                )}
                {post.publishedAt && (
                  <span>Published: {formatDate(post.publishedAt)}</span>
                )}
                {post.ctaType && <span>CTA: {post.ctaType}</span>}
                {post.failureReason && (
                  <span style={{ color: '#dc2626' }}>
                    Error: {post.failureReason}
                  </span>
                )}
              </div>
            </div>
          ))}

          {data && data.posts.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyTitle}>
                <FileText
                  size={18}
                  style={{ verticalAlign: 'middle', marginRight: 6 }}
                />
                No posts yet
              </div>
              <p className={styles.emptyText}>
                Your first GBP post is a great way to announce an offer,
                event, or product update.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function GbpPostsPage() {
  return (
    <AuthGuard>
      <GbpPostsContent />
    </AuthGuard>
  );
}
