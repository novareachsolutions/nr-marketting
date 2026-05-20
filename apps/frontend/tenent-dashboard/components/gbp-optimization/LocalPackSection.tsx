import { useState, FormEvent } from 'react';
import { MapPin, Search, Loader2, Star, Trophy } from 'lucide-react';
import { useCheckLocalPack } from '@/hooks/useGbpOptimization';
import type { LocalPackRankingResponse } from '@/types/gbp-optimization';
import styles from './LocalPackSection.module.css';

interface Props {
  locationId: string;
  locationName: string;
}

const POSITION_COLORS: Record<string, string> = {
  top3: '#22c55e',
  top10: '#84cc16',
  top20: '#f59e0b',
  beyond: '#94a3b8',
};

function getPositionColor(pos: number | null): string {
  if (pos === null) return POSITION_COLORS.beyond;
  if (pos <= 3) return POSITION_COLORS.top3;
  if (pos <= 10) return POSITION_COLORS.top10;
  if (pos <= 20) return POSITION_COLORS.top20;
  return POSITION_COLORS.beyond;
}

export function LocalPackSection({ locationId, locationName }: Props) {
  const [keyword, setKeyword] = useState('');
  const [result, setResult] = useState<LocalPackRankingResponse | null>(null);
  const checkPack = useCheckLocalPack();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = keyword.trim();
    if (!trimmed) return;
    try {
      const data = await checkPack.mutateAsync({ locationId, keyword: trimmed });
      setResult(data);
    } catch {
      // global error toast handles display
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>
          <MapPin size={16} /> Local Pack Ranking
        </h3>
        <span className={styles.creditHint}>1 SerpAPI credit per check</span>
      </div>

      <p className={styles.sectionSubtitle}>
        Check where <strong>{locationName}</strong> ranks in the Google local
        pack for a keyword. Pulls live Google Maps results.
      </p>

      <form className={styles.searchRow} onSubmit={handleSubmit}>
        <div className={styles.inputWrap}>
          <Search size={14} className={styles.inputIcon} />
          <input
            className={styles.input}
            type="text"
            placeholder='e.g. "bathroom renovation"'
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={checkPack.isPending}
          />
        </div>
        <button
          type="submit"
          className={styles.checkBtn}
          disabled={!keyword.trim() || checkPack.isPending}
        >
          {checkPack.isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Checking…
            </>
          ) : (
            <>Check Ranking</>
          )}
        </button>
      </form>

      {result && (
        <>
          {/* Summary banner */}
          <div className={styles.summaryBanner}>
            <div className={styles.summaryLeft}>
              <div className={styles.summaryLabel}>Your position for</div>
              <div className={styles.summaryKeyword}>"{result.keyword}"</div>
              <div className={styles.summaryLocation}>
                in {result.searchLocation}
              </div>
            </div>
            <div
              className={styles.summaryBadge}
              style={{
                backgroundColor: getPositionColor(result.myBusinessPosition),
              }}
            >
              {result.myBusinessFound && result.myBusinessPosition !== null ? (
                <>
                  <Trophy size={16} />
                  <span>#{result.myBusinessPosition}</span>
                </>
              ) : (
                <span>Not in top {result.totalResults || 20}</span>
              )}
            </div>
          </div>

          {/* Results table */}
          {result.topResults.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.posCol}>#</th>
                    <th>Business</th>
                    <th>Rating</th>
                    <th>Reviews</th>
                    <th>Category</th>
                    <th>Website</th>
                  </tr>
                </thead>
                <tbody>
                  {result.topResults.map((biz) => {
                    const isMine =
                      result.myBusinessPosition !== null &&
                      biz.position === result.myBusinessPosition;
                    return (
                      <tr
                        key={`${biz.position}-${biz.placeId || biz.name}`}
                        className={isMine ? styles.rowMine : ''}
                      >
                        <td>
                          <span
                            className={styles.posBadge}
                            style={{
                              backgroundColor: isMine
                                ? getPositionColor(biz.position)
                                : 'var(--bg-secondary)',
                              color: isMine ? '#fff' : 'var(--text-primary)',
                            }}
                          >
                            {biz.position}
                          </span>
                        </td>
                        <td className={styles.nameCell}>
                          <div className={styles.bizName}>
                            {biz.name}
                            {isMine && (
                              <span className={styles.youBadge}>You</span>
                            )}
                          </div>
                          {biz.address && (
                            <div className={styles.bizAddress}>
                              {biz.address}
                            </div>
                          )}
                        </td>
                        <td>
                          {biz.rating !== null ? (
                            <span className={styles.ratingCell}>
                              <Star size={12} fill="#f59e0b" stroke="#f59e0b" />
                              {biz.rating.toFixed(1)}
                            </span>
                          ) : (
                            <span className={styles.muted}>--</span>
                          )}
                        </td>
                        <td>
                          {biz.reviewCount !== null ? (
                            biz.reviewCount
                          ) : (
                            <span className={styles.muted}>--</span>
                          )}
                        </td>
                        <td className={styles.typeCell}>
                          {biz.type || <span className={styles.muted}>--</span>}
                        </td>
                        <td className={styles.urlCell}>
                          {biz.website ? (
                            <a
                              href={biz.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.urlLink}
                            >
                              {biz.website.replace(/^https?:\/\//, '').slice(0, 30)}
                            </a>
                          ) : (
                            <span className={styles.muted}>--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              No local results returned from Google for this keyword + location.
            </div>
          )}
        </>
      )}
    </div>
  );
}
