import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import {
  useGbpLocations,
  useGbpReviews,
  useReplyToGbpReview,
  useGbpAiReview,
} from '@/hooks/useGbpOptimization';
import {
  ArrowLeft,
  Star,
  MessageSquare,
  Loader2,
  Sparkles,
  Send,
} from 'lucide-react';
import styles from './index.module.css';

function StarRating({ rating }: { rating: number }) {
  return (
    <span className={styles.reviewStars}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < rating ? '#f59e0b' : 'none'}
          stroke={i < rating ? '#f59e0b' : '#d1d5db'}
        />
      ))}
    </span>
  );
}

function formatDate(iso: string) {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function GbpReviewsContent() {
  const router = useRouter();
  const { locationId: qLocationId } = router.query;
  const { data: locations = [] } = useGbpLocations();

  const activeId =
    (typeof qLocationId === 'string' && qLocationId) ||
    (locations[0]?.id ?? null);

  const { data, isLoading } = useGbpReviews(activeId, 1, 50);
  const replyMutation = useReplyToGbpReview();
  const aiMutation = useGbpAiReview();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadingAi, setLoadingAi] = useState<string | null>(null);

  const handleAi = async (reviewId: string) => {
    setLoadingAi(reviewId);
    try {
      const res = await aiMutation.mutateAsync({ id: reviewId });
      setDrafts((d) => ({ ...d, [reviewId]: res.suggestion }));
    } finally {
      setLoadingAi(null);
    }
  };

  const handleReply = async (reviewId: string) => {
    const text = drafts[reviewId];
    if (!text?.trim()) return;
    await replyMutation.mutateAsync({ id: reviewId, reply: text });
    setDrafts((d) => {
      const copy = { ...d };
      delete copy[reviewId];
      return copy;
    });
  };

  return (
    <div className={styles.layout}>
      <Head>
        <title>GBP Reviews — NR SEO</title>
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
            <h1 className={styles.pageTitle}>Reviews</h1>
          </div>
          <p className={styles.pageSubtitle}>
            Respond to GBP reviews with AI-assisted replies. Quick, genuine
            replies boost local rankings.
          </p>

          {data && (
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>
                  <Star size={12} /> Average Rating
                </div>
                <div className={styles.metricValue}>
                  {data.avgRating.toFixed(1)}
                </div>
                <div className={styles.metricSub}>out of 5 stars</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>
                  <MessageSquare size={12} /> Total Reviews
                </div>
                <div className={styles.metricValue}>{data.total}</div>
                <div className={styles.metricSub}>
                  {data.unrepliedCount} awaiting reply
                </div>
              </div>
            </div>
          )}

          {isLoading && (
            <div className={styles.loadingState}>
              <Loader2 size={16} className="animate-spin" /> Loading reviews...
            </div>
          )}

          {data?.reviews.map((review) => {
            const draft = drafts[review.id] ?? '';
            return (
              <div key={review.id} className={styles.reviewCard}>
                <div className={styles.reviewHeader}>
                  {review.reviewerPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className={styles.reviewAvatar}
                      src={review.reviewerPhoto}
                      alt={review.reviewerName || 'Reviewer'}
                    />
                  ) : (
                    <div className={styles.reviewAvatar} />
                  )}
                  <div>
                    <div className={styles.reviewerName}>
                      {review.reviewerName || 'Anonymous'}
                    </div>
                    <div className={styles.reviewDate}>
                      {formatDate(review.createdAt)}
                    </div>
                  </div>
                  <StarRating rating={review.rating} />
                </div>
                {review.comment && (
                  <p className={styles.reviewText}>{review.comment}</p>
                )}

                {review.replyText ? (
                  <div className={styles.replyBox}>
                    <div className={styles.replyLabel}>
                      Owner reply
                      {review.repliedAt
                        ? ` · ${formatDate(review.repliedAt)}`
                        : ''}
                    </div>
                    {review.replyText}
                  </div>
                ) : (
                  <>
                    <textarea
                      className={styles.replyTextarea}
                      placeholder="Write a reply…"
                      value={draft}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [review.id]: e.target.value,
                        }))
                      }
                    />
                    <div className={styles.replyActions}>
                      <button
                        className={styles.syncBtn}
                        onClick={() => handleAi(review.id)}
                        disabled={loadingAi === review.id}
                      >
                        {loadingAi === review.id ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />{' '}
                            Drafting...
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} /> AI suggest
                          </>
                        )}
                      </button>
                      <button
                        className={styles.primaryBtn}
                        disabled={
                          !draft.trim() || replyMutation.isPending
                        }
                        onClick={() => handleReply(review.id)}
                      >
                        {replyMutation.isPending ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />{' '}
                            Sending
                          </>
                        ) : (
                          <>
                            <Send size={12} /> Reply
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {data && data.reviews.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyTitle}>No reviews yet</div>
              <p className={styles.emptyText}>
                Encourage customers to leave a review on your Google Business
                Profile.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function GbpReviewsPage() {
  return (
    <AuthGuard>
      <GbpReviewsContent />
    </AuthGuard>
  );
}
