import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  BookOpen,
  Search,
  Shield,
  MessageCircle,
  Check,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { ScoreCircle } from './ScoreCircle';
import type { OriginalityResponse, ToneResponse, SeoKeywordData } from '@/types/writing-assistant';

// ─── Types ───────────────────────────────────────────────

interface SeoCheck {
  label: string;
  passed: boolean;
  detail?: string;
}

interface ReadabilityData {
  score: number;
  level: string;
  avgSentenceLength: number;
  longSentences: number;
  totalSentences: number;
  totalWords: number;
}

interface ScorePanelProps {
  overallScore: number;
  readability: ReadabilityData;
  seoScore: number;
  seoChecks: SeoCheck[];
  originalityScore: number | null;
  originalityData: OriginalityResponse | null;
  toneScore: number | null;
  toneData: ToneResponse | null;
  targetTone: string;
  onCheckOriginality: () => void;
  onCheckTone: () => void;
  isCheckingOriginality: boolean;
  isCheckingTone: boolean;
  keywordData: SeoKeywordData[];
}

// ─── Dimension Card ──────────────────────────────────────

function DimensionCard({
  icon,
  label,
  score,
  color,
  children,
  action,
  isLoading,
}: {
  icon: React.ReactNode;
  label: string;
  score: number | null;
  color: string;
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
  isLoading?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: '1px solid var(--border-primary)',
        borderRadius: 10,
        background: 'var(--bg-card)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ color, display: 'flex' }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {label}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color, minWidth: 32, textAlign: 'right' }}>
          {score !== null ? Math.round(score) : '--'}
        </span>
        {expanded ? (
          <ChevronUp size={14} style={{ color: 'var(--text-tertiary)' }} />
        ) : (
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
        )}
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border-primary)' }}>
          <div style={{ paddingTop: 12 }}>{children}</div>
          {action && (
            <button
              onClick={action.onClick}
              disabled={isLoading}
              style={{
                marginTop: 10,
                width: '100%',
                padding: '8px 0',
                border: '1px solid var(--border-primary)',
                borderRadius: 6,
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: isLoading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Analyzing...
                </>
              ) : (
                action.label
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'var(--text-tertiary)';
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
}

// ─── Main ScorePanel ─────────────────────────────────────

export function ScorePanel({
  overallScore,
  readability,
  seoScore,
  seoChecks,
  originalityScore,
  originalityData,
  toneScore,
  toneData,
  targetTone,
  onCheckOriginality,
  onCheckTone,
  isCheckingOriginality,
  isCheckingTone,
  keywordData,
}: ScorePanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Overall Score */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px 16px',
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          background: 'var(--bg-card)',
        }}
      >
        <ScoreCircle score={overallScore} size={100} strokeWidth={7} />
        <span
          style={{
            marginTop: 8,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-secondary)',
          }}
        >
          Overall Score
        </span>
      </div>

      {/* Readability */}
      <DimensionCard
        icon={<BookOpen size={16} />}
        label="Readability"
        score={readability.score}
        color={getScoreColor(readability.score)}
      >
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          <strong>{readability.level}</strong> — Flesch Reading Ease
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Avg sentence length</span>
            <span style={{ color: readability.avgSentenceLength <= 20 ? '#22c55e' : '#eab308', fontWeight: 600 }}>
              {readability.avgSentenceLength} words
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Long sentences (&gt;25 words)</span>
            <span style={{ color: readability.longSentences === 0 ? '#22c55e' : '#eab308', fontWeight: 600 }}>
              {readability.longSentences}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Total sentences</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{readability.totalSentences}</span>
          </div>
        </div>
      </DimensionCard>

      {/* SEO */}
      <DimensionCard
        icon={<Search size={16} />}
        label="SEO"
        score={seoScore}
        color={getScoreColor(seoScore)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {seoChecks.map((check, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
              {check.passed ? (
                <Check size={14} style={{ color: '#22c55e', flexShrink: 0, marginTop: 1 }} />
              ) : (
                <X size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
              )}
              <div>
                <div style={{ color: 'var(--text-primary)' }}>{check.label}</div>
                {check.detail && (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{check.detail}</div>
                )}
              </div>
            </div>
          ))}
        </div>
        {keywordData.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-primary)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase' }}>
              Keyword Data
            </div>
            {keywordData.map((kw) => (
              <div key={kw.keyword} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-primary)' }}>{kw.keyword}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>
                  {kw.searchVolume !== null ? `${kw.searchVolume} vol` : 'N/A'}
                  {kw.difficulty !== null ? ` · ${kw.difficulty}% KD` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </DimensionCard>

      {/* Originality */}
      <DimensionCard
        icon={<Shield size={16} />}
        label="Originality"
        score={originalityScore}
        color={getScoreColor(originalityScore)}
        action={{ label: 'Check Originality', onClick: onCheckOriginality }}
        isLoading={isCheckingOriginality}
      >
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>
          AI originality assessment (not a plagiarism database check)
        </div>
        {originalityData && originalityData.flags.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {originalityData.flags.map((flag, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
                <AlertTriangle size={13} style={{ color: '#eab308', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>
                    &ldquo;{flag.sentence.slice(0, 80)}...&rdquo;
                  </div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{flag.concern}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {originalityData && originalityData.flags.length === 0 && (
          <div style={{ fontSize: 12, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={14} /> No significant originality concerns
          </div>
        )}
      </DimensionCard>

      {/* Tone of Voice */}
      <DimensionCard
        icon={<MessageCircle size={16} />}
        label="Tone of Voice"
        score={toneScore}
        color={getScoreColor(toneScore)}
        action={{ label: 'Check Tone', onClick: onCheckTone }}
        isLoading={isCheckingTone}
      >
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Target: <strong style={{ textTransform: 'capitalize' }}>{targetTone}</strong>
          {toneData && (
            <>
              {' '}· Detected: <strong style={{ textTransform: 'capitalize' }}>{toneData.detectedTone}</strong>
            </>
          )}
        </div>
        {toneData && toneData.segments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {toneData.segments.map((seg, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
                {seg.consistent ? (
                  <Check size={13} style={{ color: '#22c55e', flexShrink: 0, marginTop: 1 }} />
                ) : (
                  <AlertTriangle size={13} style={{ color: '#eab308', flexShrink: 0, marginTop: 1 }} />
                )}
                <div>
                  <div style={{ color: 'var(--text-primary)' }}>
                    &ldquo;{seg.text.slice(0, 60)}...&rdquo;
                  </div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'capitalize' }}>
                    {seg.tone}{!seg.consistent ? ' (inconsistent)' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DimensionCard>
    </div>
  );
}

export type { SeoCheck, ReadabilityData };
