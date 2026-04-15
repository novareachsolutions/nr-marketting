import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { apiClient } from '@repo/shared-frontend';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import {
  useContentBrief,
  useSendBriefToWriter,
} from '@/hooks/useContentTemplate';
import {
  RecommendationsCard,
  BacklinksCard,
  SemanticKeywordsCard,
  OnPageRulesCard,
  RivalsCard,
} from '@/components/content-template/BriefCards';
import {
  ArrowLeft,
  Download,
  PenTool,
  Loader2,
  AlertCircle,
} from 'lucide-react';

function ContentTemplateDetailContent() {
  const router = useRouter();
  const id = (router.query.id as string) || '';
  const queryProjectId = (router.query.projectId as string) || '';
  const backHref = `/dashboard/content-template${
    queryProjectId ? `?projectId=${queryProjectId}` : ''
  }`;

  const { data: brief, isLoading, error } = useContentBrief(id || null);
  const sendToWriter = useSendBriefToWriter();

  const handleExport = async () => {
    try {
      const res = await apiClient.get(`/seo-content-template/${id}/export`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/msword' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const keywords = (brief?.targetKeywords as string[]) || [];
      const slug = (keywords[0] || 'brief')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      a.download = `seo-brief-${slug}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download brief. Please try again.');
    }
  };

  const handleSendToWriter = () => {
    sendToWriter.mutate(id, {
      onSuccess: (data) => {
        router.push(
          `/dashboard/writing-assistant?documentId=${data.documentId}${
            queryProjectId ? `&projectId=${queryProjectId}` : ''
          }`,
        );
      },
      onError: () => {
        alert('Failed to send to Writing Assistant.');
      },
    });
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          color: 'var(--text-tertiary, #6b7280)',
          gap: 10,
        }}
      >
        <Loader2 size={18} className="animate-spin" /> Loading brief…
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 12,
          color: 'var(--text-tertiary, #6b7280)',
        }}
      >
        <AlertCircle size={24} />
        <p>Brief not found or failed to load.</p>
        <Link
          href={backHref}
          style={{
            fontSize: 13,
            color: 'var(--accent-primary)',
            textDecoration: 'none',
          }}
        >
          ← Back to briefs
        </Link>
      </div>
    );
  }

  const keywords = (brief.targetKeywords as string[]) || [];
  const primaryKeyword = keywords[0] || '';

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 1100,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <Link
            href={backHref}
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary, #6b7280)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 6,
            }}
          >
            <ArrowLeft size={12} /> Back to briefs
          </Link>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              marginBottom: 4,
            }}
          >
            Brief for &ldquo;{keywords.join(', ')}&rdquo;
          </h1>
          <p
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary, #6b7280)',
              margin: 0,
            }}
          >
            Country: {brief.country} · Generated {new Date(brief.createdAt).toLocaleString()}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleExport}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              background: 'var(--bg-surface, #f8fafc)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Download size={14} /> Export .doc
          </button>
          <button
            onClick={handleSendToWriter}
            disabled={sendToWriter.isPending}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              background: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: sendToWriter.isPending ? 'not-allowed' : 'pointer',
              opacity: sendToWriter.isPending ? 0.7 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {sendToWriter.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Creating…
              </>
            ) : (
              <>
                <PenTool size={14} /> Send to Writing Assistant
              </>
            )}
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div
        style={{
          padding: '10px 14px',
          background: '#fef9c3',
          border: '1px solid #fde68a',
          borderRadius: 8,
          marginBottom: 20,
          fontSize: 12,
          color: '#713f12',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <AlertCircle size={14} />
        Competitor data is AI-estimated. Verify URLs before backlink outreach.
      </div>

      {/* Cards */}
      <RecommendationsCard
        avgReadability={brief.avgReadability}
        recommendedWordCount={brief.recommendedWordCount}
      />
      <OnPageRulesCard
        titleSuggestion={brief.titleSuggestion}
        metaSuggestion={brief.metaSuggestion}
        h1Suggestion={brief.h1Suggestion}
        primaryKeyword={primaryKeyword}
      />
      <SemanticKeywordsCard keywords={brief.semanticKeywords || []} />
      <RivalsCard rivals={brief.topRivals || []} primaryKeyword={primaryKeyword} />
      <BacklinksCard targets={brief.backlinkTargets || []} />
    </main>
  );
}

export default function ContentTemplateDetailPage() {
  const router = useRouter();
  const queryProjectId = (router.query.projectId as string) || '';

  return (
    <AuthGuard>
      <Head>
        <title>SEO Content Brief — NR SEO Platform</title>
      </Head>
      <Sidebar projectId={queryProjectId || undefined} />
      <div className={sidebarStyles.contentWithSidebar}>
        <ContentTemplateDetailContent />
      </div>
    </AuthGuard>
  );
}
