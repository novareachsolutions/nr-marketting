import { useState } from 'react';
import {
  ExternalLink,
  Link2,
  FileText,
  BookOpen,
  Hash,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { RivalItem } from '@/types/seo-content-template';

// ─── Shared Card Wrapper ─────────────────────────────────

function Card({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: subtitle ? 4 : 12 }}>
        <div style={{ color: 'var(--accent-primary)' }}>{icon}</div>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          {title}
        </h3>
      </div>
      {subtitle && (
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary, #6b7280)',
            margin: '0 0 12px 34px',
          }}
        >
          {subtitle}
        </p>
      )}
      <div>{children}</div>
    </div>
  );
}

// ─── Recommendations Card ────────────────────────────────

export function RecommendationsCard({
  avgReadability,
  recommendedWordCount,
}: {
  avgReadability: number;
  recommendedWordCount: number;
}) {
  return (
    <Card
      icon={<BookOpen size={18} />}
      title="Key Recommendations"
      subtitle="Based on your Google top 10 rivals"
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        <Stat label="Average readability" value={`${avgReadability}/100`} hint="Flesch reading ease" />
        <Stat label="Recommended text length" value={`${recommendedWordCount.toLocaleString()} words`} hint="Average of top 10" />
      </div>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div
      style={{
        background: 'var(--accent-primary-light)',
        border: '1px solid var(--border-primary)',
        borderRadius: 10,
        padding: '14px 16px',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #6b7280)', marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--accent-primary)',
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #6b7280)', marginTop: 2 }}>
        {hint}
      </div>
    </div>
  );
}

// ─── Backlinks Card ──────────────────────────────────────

export function BacklinksCard({ targets }: { targets: string[] }) {
  return (
    <Card
      icon={<Link2 size={18} />}
      title="Backlink Targets"
      subtitle="Try to acquire backlinks from these domains"
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {targets.map((d) => (
          <span
            key={d}
            style={{
              fontSize: 12,
              padding: '5px 10px',
              background: 'var(--bg-surface, #f8fafc)',
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              color: 'var(--text-secondary, #374151)',
            }}
          >
            {d}
          </span>
        ))}
      </div>
    </Card>
  );
}

// ─── Semantic Keywords Card ──────────────────────────────

export function SemanticKeywordsCard({ keywords }: { keywords: string[] }) {
  return (
    <Card
      icon={<Hash size={18} />}
      title="Semantic Keywords"
      subtitle="Include these related terms in your content"
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {keywords.map((k) => (
          <span
            key={k}
            style={{
              fontSize: 12,
              padding: '5px 10px',
              background: 'var(--accent-primary-light)',
              border: '1px solid var(--border-primary)',
              borderRadius: 999,
              color: 'var(--accent-primary)',
              fontWeight: 500,
            }}
          >
            {k}
          </span>
        ))}
      </div>
    </Card>
  );
}

// ─── On-Page Rules Card ──────────────────────────────────

export function OnPageRulesCard({
  titleSuggestion,
  metaSuggestion,
  h1Suggestion,
  primaryKeyword,
}: {
  titleSuggestion: string;
  metaSuggestion: string;
  h1Suggestion: string;
  primaryKeyword: string;
}) {
  const rows: Array<{
    label: string;
    value: string;
    maxLength: number;
    rule: string;
  }> = [
    {
      label: 'Page Title',
      value: titleSuggestion,
      maxLength: 55,
      rule: `Include "${primaryKeyword}" once · max 55 chars`,
    },
    {
      label: 'Meta Description',
      value: metaSuggestion,
      maxLength: 160,
      rule: `Include "${primaryKeyword}" once · max 160 chars`,
    },
    {
      label: 'H1 Heading',
      value: h1Suggestion,
      maxLength: 70,
      rule: `Include "${primaryKeyword}" once · max 70 chars`,
    },
  ];

  return (
    <Card icon={<FileText size={18} />} title="On-Page Recommendations">
      {rows.map((r) => {
        const over = r.value.length > r.maxLength;
        return (
          <div
            key={r.label}
            style={{
              padding: '12px 0',
              borderBottom: '1px solid var(--border-primary)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #374151)' }}>
                {r.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: over ? '#dc2626' : 'var(--text-tertiary, #6b7280)',
                }}
              >
                {r.value.length}/{r.maxLength}
              </span>
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-primary)',
                padding: '8px 12px',
                background: 'var(--bg-surface, #f8fafc)',
                borderRadius: 6,
                border: '1px solid var(--border-primary)',
                marginBottom: 4,
              }}
            >
              {r.value || '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary, #6b7280)' }}>
              {r.rule}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// ─── Rivals Card ─────────────────────────────────────────

export function RivalsCard({
  rivals,
  primaryKeyword,
}: {
  rivals: RivalItem[];
  primaryKeyword: string;
}) {
  return (
    <Card
      icon={<ExternalLink size={18} />}
      title="Top 10 Competitors"
      subtitle={`How your rivals use "${primaryKeyword}" in their content`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rivals.map((r) => (
          <RivalRow key={`${r.rank}-${r.url}`} rival={r} primaryKeyword={primaryKeyword} />
        ))}
      </div>
    </Card>
  );
}

function RivalRow({ rival, primaryKeyword }: { rival: RivalItem; primaryKeyword: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      style={{
        border: '1px solid var(--border-primary)',
        borderRadius: 8,
        padding: 12,
        background: 'var(--bg-surface, #f8fafc)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            minWidth: 24,
            height: 24,
            borderRadius: 6,
            background: 'var(--accent-primary)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {rival.rank}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {rival.title}
          </div>
          <a
            href={rival.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              color: 'var(--accent-primary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}
          >
            {rival.url} <ExternalLink size={10} />
          </a>
          <p
            style={{
              fontSize: 12,
              color: 'var(--text-secondary, #374151)',
              margin: '6px 0 0',
              lineHeight: 1.5,
            }}
            dangerouslySetInnerHTML={{
              __html: highlightKeyword(rival.snippet, primaryKeyword),
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-tertiary, #6b7280)' }}>
              {rival.totalOccurrences} keyword occurrences
            </span>
            {rival.exampleSentences.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  fontSize: 11,
                  color: 'var(--accent-primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {expanded ? (
                  <>
                    Hide examples <ChevronUp size={12} />
                  </>
                ) : (
                  <>
                    Show examples <ChevronDown size={12} />
                  </>
                )}
              </button>
            )}
          </div>
          {expanded && rival.exampleSentences.length > 0 && (
            <ul style={{ margin: '8px 0 0', padding: '0 0 0 16px' }}>
              {rival.exampleSentences.map((s, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary, #374151)',
                    marginBottom: 4,
                    lineHeight: 1.5,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: highlightKeyword(s, primaryKeyword),
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function highlightKeyword(text: string, keyword: string): string {
  if (!keyword) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const kwEscaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${kwEscaped})`, 'gi');
  return escaped.replace(
    regex,
    '<mark style="background: #fef3c7; color: #92400e; padding: 0 2px; border-radius: 2px;">$1</mark>',
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
