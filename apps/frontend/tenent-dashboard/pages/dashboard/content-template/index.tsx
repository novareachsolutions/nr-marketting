import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import {
  useContentBriefs,
  useGenerateBrief,
  useDeleteBrief,
} from '@/hooks/useContentTemplate';
import {
  Sparkles,
  Loader2,
  Trash2,
  FileText,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';

function ContentTemplateContent() {
  const router = useRouter();
  const queryProjectId = (router.query.projectId as string) || '';

  const [keyword, setKeyword] = useState('');
  const [country, setCountry] = useState('US');
  const [error, setError] = useState<string | null>(null);

  const { data: listData, refetch } = useContentBriefs(queryProjectId || undefined);
  const generate = useGenerateBrief();
  const deleteBrief = useDeleteBrief();

  const handleGenerate = () => {
    const kw = keyword.trim();
    if (!kw) {
      setError('Please enter a target keyword.');
      return;
    }
    setError(null);
    generate.mutate(
      {
        targetKeywords: [kw],
        country,
        projectId: queryProjectId || undefined,
      },
      {
        onSuccess: (data) => {
          setKeyword('');
          refetch();
          router.push(
            `/dashboard/content-template/${data.id}${
              queryProjectId ? `?projectId=${queryProjectId}` : ''
            }`,
          );
        },
        onError: (err: any) => {
          setError(err?.message || 'Failed to generate brief. Please try again.');
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this brief?')) return;
    deleteBrief.mutate(`/seo-content-template/${id}`, {
      onSuccess: () => refetch(),
    });
  };

  return (
    <>
      <Head>
        <title>SEO Content Template — NR SEO Platform</title>
      </Head>
      <Sidebar projectId={queryProjectId || undefined} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main
          style={{
            padding: 24,
            maxWidth: 1200,
            margin: '0 auto',
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                marginBottom: 4,
              }}
            >
              SEO Content Template
            </h1>
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-tertiary, #6b7280)',
                margin: 0,
              }}
            >
              Generate actionable SEO content briefs for your target keywords.
            </p>
          </div>

          {/* Generate form */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-primary)',
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Lightbulb size={18} style={{ color: 'var(--accent-primary)' }} />
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Generate a new brief
              </h2>
            </div>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-tertiary, #6b7280)',
                margin: '0 0 16px 26px',
              }}
            >
              Enter a target keyword and we&apos;ll generate a data-backed content brief.
            </p>

            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                alignItems: 'stretch',
              }}
            >
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !generate.isPending) handleGenerate();
                }}
                placeholder="e.g. tiles, ceramic flooring, kitchen backsplash"
                disabled={generate.isPending}
                style={{
                  flex: '1 1 320px',
                  padding: '10px 14px',
                  fontSize: 14,
                  border: '1px solid var(--border-primary)',
                  borderRadius: 8,
                  background: 'var(--bg-surface, #f8fafc)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={generate.isPending}
                style={{
                  padding: '10px 14px',
                  fontSize: 14,
                  border: '1px solid var(--border-primary)',
                  borderRadius: 8,
                  background: 'var(--bg-surface, #f8fafc)',
                  color: 'var(--text-primary)',
                  minWidth: 140,
                }}
              >
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="CA">Canada</option>
                <option value="IN">India</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="ES">Spain</option>
                <option value="IT">Italy</option>
                <option value="BR">Brazil</option>
                <option value="JP">Japan</option>
                <option value="SG">Singapore</option>
                <option value="NZ">New Zealand</option>
              </select>
              <button
                onClick={handleGenerate}
                disabled={generate.isPending || !keyword.trim()}
                style={{
                  padding: '10px 18px',
                  fontSize: 14,
                  fontWeight: 600,
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: generate.isPending ? 'not-allowed' : 'pointer',
                  opacity: generate.isPending || !keyword.trim() ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {generate.isPending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> Generate brief
                  </>
                )}
              </button>
            </div>

            {error && (
              <div
                style={{
                  marginTop: 12,
                  padding: '8px 12px',
                  background: '#fef2f2',
                  color: '#991b1b',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            )}

            {generate.isPending && (
              <p
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: 'var(--text-tertiary, #6b7280)',
                }}
              >
                This may take 20–40 seconds. We&apos;re analyzing the top 10 ranking pages and
                building your brief.
              </p>
            )}
          </div>

          {/* List */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-primary)',
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 14,
              }}
            >
              <FileText size={17} style={{ color: 'var(--accent-primary)' }} />
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                My Briefs {listData ? `(${listData.total})` : ''}
              </h2>
            </div>

            {!listData || listData.briefs.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--text-tertiary, #6b7280)',
                  fontSize: 13,
                }}
              >
                No briefs yet. Enter a keyword above to generate your first one.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {listData.briefs.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      background: 'var(--bg-surface, #f8fafc)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: 2,
                        }}
                      >
                        {(b.targetKeywords as string[]).join(', ')}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-tertiary, #6b7280)',
                        }}
                      >
                        {b.country} · {b.recommendedWordCount} words · readability {b.avgReadability}/100 ·{' '}
                        {new Date(b.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/content-template/${b.id}${
                        queryProjectId ? `?projectId=${queryProjectId}` : ''
                      }`}
                      style={{
                        fontSize: 12,
                        padding: '6px 12px',
                        background: 'var(--accent-primary)',
                        color: '#fff',
                        borderRadius: 6,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      Open <ArrowRight size={12} />
                    </Link>
                    <button
                      onClick={() => handleDelete(b.id)}
                      style={{
                        padding: 6,
                        background: 'transparent',
                        color: 'var(--text-tertiary, #6b7280)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export default function ContentTemplatePage() {
  return (
    <AuthGuard>
      <ContentTemplateContent />
    </AuthGuard>
  );
}
