import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { GuideModal } from '@/components/ui/Dialog';
import { WritingEditor } from '@/components/writing-assistant/WritingEditor';
import type { WritingEditorHandle } from '@/components/writing-assistant/WritingEditor';
import { ScorePanel } from '@/components/writing-assistant/ScorePanel';
import type { SeoCheck, ReadabilityData } from '@/components/writing-assistant/ScorePanel';
import { KeywordManager } from '@/components/writing-assistant/KeywordManager';
import { AiToolbar } from '@/components/writing-assistant/AiToolbar';
import { RephraseModal } from '@/components/writing-assistant/RephraseModal';
import { ComposeModal } from '@/components/writing-assistant/ComposeModal';
import { AskAiModal } from '@/components/writing-assistant/AskAiModal';
import { DocumentList } from '@/components/writing-assistant/DocumentList';
import {
  useWritingDocuments,
  useWritingDocument,
  useCreateDocument,
  useUpdateDocument,
  useDeleteDocument,
  useCheckOriginality,
  useCheckTone,
  useSeoAnalysis,
} from '@/hooks/useWritingAssistant';
import {
  Plus,
  Save,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import type {
  OriginalityResponse,
  ToneResponse,
  SeoKeywordData,
  ToneType,
} from '@/types/writing-assistant';
import styles from './index.module.css';

// ─── Scoring Utilities ───────────────────────────────────

function countSyllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  w = w.replace(/^y/, '');
  const matches = w.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function calculateReadability(text: string): ReadabilityData {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const totalWords = words.length;
  const totalSentences = Math.max(sentences.length, 1);

  if (totalWords < 5) {
    return { score: 0, level: 'Too short', avgSentenceLength: 0, longSentences: 0, totalSentences: 0, totalWords };
  }

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgSentenceLength = Math.round(totalWords / totalSentences);
  const raw = 206.835 - 1.015 * (totalWords / totalSentences) - 84.6 * (totalSyllables / totalWords);
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const longSentences = sentences.filter(
    (s) => s.trim().split(/\s+/).length > 25,
  ).length;

  let level = 'Very Difficult';
  if (score >= 90) level = 'Very Easy';
  else if (score >= 80) level = 'Easy';
  else if (score >= 70) level = 'Fairly Easy';
  else if (score >= 60) level = 'Standard';
  else if (score >= 50) level = 'Fairly Difficult';
  else if (score >= 30) level = 'Difficult';

  return { score, level, avgSentenceLength, longSentences, totalSentences, totalWords };
}

function getKeywordDensity(text: string, keyword: string): number {
  if (!text || !keyword) return 0;
  const words = text.toLowerCase().split(/\s+/);
  const kwWords = keyword.toLowerCase().split(/\s+/);
  if (words.length === 0) return 0;
  let count = 0;
  for (let i = 0; i <= words.length - kwWords.length; i++) {
    if (words.slice(i, i + kwWords.length).join(' ') === keyword.toLowerCase()) count++;
  }
  return (count * kwWords.length) / words.length * 100;
}

function calculateSeoScore(
  title: string,
  metaDescription: string,
  plainText: string,
  htmlContent: string,
  keywords: string[],
): { score: number; checks: SeoCheck[] } {
  const primaryKw = keywords[0] || '';
  const checks: SeoCheck[] = [];
  let points = 0;

  // Title contains keyword (15)
  const titleHasKw = primaryKw && title.toLowerCase().includes(primaryKw.toLowerCase());
  checks.push({ label: 'Title contains primary keyword', passed: !!titleHasKw, detail: primaryKw ? undefined : 'Add a target keyword first' });
  if (titleHasKw) points += 15;

  // Title length (5)
  const titleLen = title.length >= 30 && title.length <= 65;
  checks.push({ label: 'Title length (30-65 chars)', passed: titleLen, detail: `${title.length} characters` });
  if (titleLen) points += 5;

  // Meta contains keyword (10)
  const metaHasKw = primaryKw && metaDescription.toLowerCase().includes(primaryKw.toLowerCase());
  checks.push({ label: 'Meta description contains keyword', passed: !!metaHasKw });
  if (metaHasKw) points += 10;

  // Meta length (5)
  const metaLen = metaDescription.length >= 120 && metaDescription.length <= 160;
  checks.push({ label: 'Meta description length (120-160 chars)', passed: metaLen, detail: `${metaDescription.length} characters` });
  if (metaLen) points += 5;

  // H1 contains keyword (10)
  const h1Match = htmlContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, '') : '';
  const h1HasKw = primaryKw && h1Text.toLowerCase().includes(primaryKw.toLowerCase());
  checks.push({ label: 'H1 heading contains keyword', passed: !!h1HasKw });
  if (h1HasKw) points += 10;

  // Keyword in first 100 words (10)
  const first100 = plainText.split(/\s+/).slice(0, 100).join(' ').toLowerCase();
  const kwInFirst100 = primaryKw && first100.includes(primaryKw.toLowerCase());
  checks.push({ label: 'Keyword in first 100 words', passed: !!kwInFirst100 });
  if (kwInFirst100) points += 10;

  // Keyword density (15)
  const density = primaryKw ? getKeywordDensity(plainText, primaryKw) : 0;
  const densityOk = density >= 1 && density <= 3;
  checks.push({ label: 'Keyword density (1-3%)', passed: densityOk, detail: primaryKw ? `${density.toFixed(1)}%` : 'Add a keyword' });
  if (densityOk) points += 15;

  // Content length (10)
  const wordCount = plainText.split(/\s+/).filter((w) => w.length > 0).length;
  const lengthOk = wordCount >= 300;
  checks.push({ label: 'Content length (300+ words)', passed: lengthOk, detail: `${wordCount} words` });
  if (lengthOk) points += 10;

  // Subheadings (5)
  const subheadings = (htmlContent.match(/<h[2-3][^>]*>/gi) || []).length;
  checks.push({ label: 'Subheadings present (H2/H3)', passed: subheadings >= 2, detail: `${subheadings} found` });
  if (subheadings >= 2) points += 5;

  // Keyword in subheadings (5)
  const subheadingTexts = (htmlContent.match(/<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/gi) || [])
    .map((h) => h.replace(/<[^>]+>/g, '').toLowerCase());
  const kwInSubs = primaryKw && subheadingTexts.some((t) => t.includes(primaryKw.toLowerCase()));
  checks.push({ label: 'Keyword in subheadings', passed: !!kwInSubs });
  if (kwInSubs) points += 5;

  // Links (5)
  const links = (htmlContent.match(/<a\s/gi) || []).length;
  checks.push({ label: 'Links present', passed: links >= 1, detail: `${links} found` });
  if (links >= 1) points += 5;

  return { score: Math.min(points, 100), checks };
}

function calculateOverallScore(
  readability: number,
  seo: number,
  originality: number | null,
  tone: number | null,
): number {
  let total = 0;
  let weight = 0;
  total += readability * 0.25; weight += 0.25;
  total += seo * 0.35; weight += 0.35;
  if (originality !== null) { total += originality * 0.20; weight += 0.20; }
  if (tone !== null) { total += tone * 0.20; weight += 0.20; }
  return Math.round(total / weight);
}

// ─── Main Component ──────────────────────────────────────

function WritingAssistantContent() {
  const router = useRouter();
  const queryProjectId = (router.query.projectId as string) || '';

  // Document state
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [plainText, setPlainText] = useState('');
  const [targetKeywords, setTargetKeywords] = useState<string[]>([]);
  const [metaDescription, setMetaDescription] = useState('');
  const [targetTone, setTargetTone] = useState<ToneType>('neutral');

  // AI scores (on-demand)
  const [originalityScore, setOriginalityScore] = useState<number | null>(null);
  const [originalityData, setOriginalityData] = useState<OriginalityResponse | null>(null);
  const [toneScore, setToneScore] = useState<number | null>(null);
  const [toneData, setToneData] = useState<ToneResponse | null>(null);
  const [keywordData, setKeywordData] = useState<SeoKeywordData[]>([]);

  // UI state
  const [selectedText, setSelectedText] = useState('');
  const [showRephraseModal, setShowRephraseModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showAskAiModal, setShowAskAiModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showDocList, setShowDocList] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Auto-save timer
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(false);
  const editorApiRef = useRef<WritingEditorHandle | null>(null);

  // Hooks
  const { data: docListData } = useWritingDocuments(queryProjectId || undefined);
  const { data: loadedDoc } = useWritingDocument(documentId);
  const createDoc = useCreateDocument();
  const updateDoc = useUpdateDocument();
  const deleteDoc = useDeleteDocument();
  const checkOriginality = useCheckOriginality();
  const checkTone = useCheckTone();
  const seoAnalysis = useSeoAnalysis();

  // Compute scores
  const readability = calculateReadability(plainText);
  const { score: seoScore, checks: seoChecks } = calculateSeoScore(
    title, metaDescription, plainText, htmlContent, targetKeywords,
  );
  const overallScore = calculateOverallScore(readability.score, seoScore, originalityScore, toneScore);

  // Load document when selected
  useEffect(() => {
    if (loadedDoc) {
      skipNextSaveRef.current = true;
      setTitle(loadedDoc.title);
      setHtmlContent(loadedDoc.content);
      setPlainText(loadedDoc.plainText);
      setTargetKeywords((loadedDoc.targetKeywords as string[] | null) || []);
      setMetaDescription(loadedDoc.metaDescription || '');
      setTargetTone((loadedDoc.targetTone as ToneType) || 'neutral');
      setOriginalityScore(loadedDoc.originalityScore);
      setToneScore(loadedDoc.toneScore);
      setOriginalityData(null);
      setToneData(null);
    }
  }, [loadedDoc]);

  // Auto-save (debounced 2s)
  const triggerAutoSave = useCallback(() => {
    if (!documentId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      updateDoc.mutate(
        {
          url: `/writing/documents/${documentId}`,
          body: {
            title,
            content: htmlContent,
            plainText,
            targetKeywords,
            metaDescription,
            readabilityScore: readability.score,
            seoScore,
            originalityScore,
            toneScore,
            overallScore,
            targetTone,
            wordCount: readability.totalWords,
          },
        },
        {
          onSuccess: () => setSaveStatus('saved'),
          onError: () => setSaveStatus('idle'),
        },
      );
    }, 2000);
  }, [documentId, title, htmlContent, plainText, targetKeywords, metaDescription, targetTone, readability.score, seoScore, originalityScore, toneScore, overallScore]);

  // Trigger auto-save on content changes
  useEffect(() => {
    if (!documentId) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    triggerAutoSave();
  }, [title, htmlContent, metaDescription, targetKeywords, targetTone]);

  // Fetch keyword data when keywords change
  useEffect(() => {
    if (targetKeywords.length > 0) {
      seoAnalysis.mutate(
        { keywords: targetKeywords, country: 'AU' },
        { onSuccess: (data) => setKeywordData(data.keywords) },
      );
    } else {
      setKeywordData([]);
    }
  }, [targetKeywords.join(',')]);

  // Handlers
  const handleNewDocument = () => {
    createDoc.mutate(
      {
        url: '/writing/documents',
        body: { title: 'Untitled', projectId: queryProjectId || undefined, targetTone },
      },
      {
        onSuccess: (data: any) => {
          skipNextSaveRef.current = true;
          setDocumentId(data.id);
          setTitle('Untitled');
          setHtmlContent('');
          setPlainText('');
          setTargetKeywords([]);
          setMetaDescription('');
          setOriginalityScore(null);
          setToneScore(null);
          setOriginalityData(null);
          setToneData(null);
        },
      },
    );
  };

  const handleDeleteDocument = (id: string) => {
    deleteDoc.mutate(`/writing/documents/${id}`, {
      onSuccess: () => {
        if (documentId === id) {
          setDocumentId(null);
          setTitle('');
          setHtmlContent('');
          setPlainText('');
          setTargetKeywords([]);
          setMetaDescription('');
        }
      },
    });
  };

  const handleContentChange = (html: string, text: string) => {
    setHtmlContent(html);
    setPlainText(text);
  };

  const handleCheckOriginality = () => {
    if (!plainText.trim()) return;
    checkOriginality.mutate(
      { text: plainText },
      {
        onSuccess: (data) => {
          setOriginalityScore(data.score);
          setOriginalityData(data);
        },
      },
    );
  };

  const handleCheckTone = () => {
    if (!plainText.trim()) return;
    checkTone.mutate(
      { text: plainText, targetTone },
      {
        onSuccess: (data) => {
          setToneScore(data.score);
          setToneData(data);
        },
      },
    );
  };

  const handleReplaceText = (newText: string) => {
    editorApiRef.current?.replaceSelection(newText);
  };

  const handleInsertBelow = (text: string) => {
    editorApiRef.current?.appendHtml(`<p>${text}</p>`);
  };

  const handleInsertContent = (html: string) => {
    editorApiRef.current?.appendHtml(html);
  };

  return (
    <>
      <Head>
        <title>SEO Writing Assistant — NR SEO Platform</title>
      </Head>
      <Sidebar projectId={queryProjectId || undefined} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          {/* Top Bar */}
          <div className={styles.topBar}>
            <div className={styles.topBarLeft}>
              <h1 className={styles.pageTitle}>SEO Writing Assistant</h1>
              <button className={styles.guideBtn} onClick={() => setShowGuide(true)} title="How to use">
                ?
              </button>
            </div>
            <div className={styles.topBarRight}>
              {saveStatus === 'saving' && (
                <span className={styles.saveStatus}>
                  <Loader2 size={13} className="animate-spin" /> Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className={`${styles.saveStatus} ${styles.savedBadge}`}>
                  <Check size={13} /> Saved
                </span>
              )}
              <select
                className={styles.toneSelect}
                value={targetTone}
                onChange={(e) => setTargetTone(e.target.value as ToneType)}
              >
                <option value="formal">Formal</option>
                <option value="neutral">Neutral</option>
                <option value="casual">Casual</option>
              </select>
              <button className={styles.newDocBtn} onClick={handleNewDocument}>
                <Plus size={14} /> New Document
              </button>
            </div>
          </div>

          {/* Guide */}
          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="SEO Writing Assistant — Guide">
            <h4>What is the Writing Assistant?</h4>
            <p>A real-time content editor that scores your writing on Readability, SEO, Originality, and Tone of Voice.</p>
            <h4>How to use it</h4>
            <ul>
              <li><strong>Create a document</strong> — Click &ldquo;New Document&rdquo; to start writing.</li>
              <li><strong>Add keywords</strong> — Enter target keywords to track density and SEO score.</li>
              <li><strong>Write content</strong> — Readability and SEO scores update in real-time.</li>
              <li><strong>Check Originality</strong> — Click &ldquo;Check Originality&rdquo; for an AI assessment.</li>
              <li><strong>Check Tone</strong> — Click &ldquo;Check Tone&rdquo; to verify tone consistency.</li>
              <li><strong>AI Tools</strong> — Use Rephrase, Compose, and Ask AI for writing help.</li>
            </ul>
            <h4>Scoring</h4>
            <ul>
              <li><strong>Readability (25%)</strong> — Flesch Reading Ease score.</li>
              <li><strong>SEO (35%)</strong> — Keyword usage, title, meta, headings, content length.</li>
              <li><strong>Originality (20%)</strong> — AI assessment of content uniqueness.</li>
              <li><strong>Tone (20%)</strong> — Consistency with your target tone.</li>
            </ul>
          </GuideModal>

          {/* Document List (collapsible) */}
          {docListData && docListData.documents.length > 0 && (
            <div className={styles.docListPanel}>
              <div className={styles.docListHeader} onClick={() => setShowDocList(!showDocList)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={15} />
                  My Documents ({docListData.total})
                </span>
                {showDocList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {showDocList && (
                <div className={styles.docListBody}>
                  <DocumentList
                    documents={docListData.documents}
                    onSelect={setDocumentId}
                    onDelete={handleDeleteDocument}
                    activeId={documentId}
                  />
                </div>
              )}
            </div>
          )}

          {/* Main Content */}
          {documentId ? (
            <div className={styles.twoCol}>
              <div className={styles.editorCol}>
                {/* Keyword Manager */}
                <KeywordManager
                  keywords={targetKeywords}
                  onChange={setTargetKeywords}
                  plainText={plainText}
                />

                {/* Editor */}
                <WritingEditor
                  ref={editorApiRef}
                  htmlContent={htmlContent}
                  onContentChange={handleContentChange}
                  title={title}
                  onTitleChange={setTitle}
                  metaDescription={metaDescription}
                  onMetaDescriptionChange={setMetaDescription}
                  wordCount={readability.totalWords}
                  onTextSelect={setSelectedText}
                />

                {/* AI Toolbar */}
                <AiToolbar
                  selectedText={selectedText}
                  onRephrase={() => setShowRephraseModal(true)}
                  onCompose={() => setShowComposeModal(true)}
                  onAskAi={() => setShowAskAiModal(true)}
                />
              </div>

              {/* Score Panel */}
              <div className={styles.scoreCol}>
                <ScorePanel
                  overallScore={overallScore}
                  readability={readability}
                  seoScore={seoScore}
                  seoChecks={seoChecks}
                  originalityScore={originalityScore}
                  originalityData={originalityData}
                  toneScore={toneScore}
                  toneData={toneData}
                  targetTone={targetTone}
                  onCheckOriginality={handleCheckOriginality}
                  onCheckTone={handleCheckTone}
                  isCheckingOriginality={checkOriginality.isPending}
                  isCheckingTone={checkTone.isPending}
                  keywordData={keywordData}
                />
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                SEO Writing Assistant
              </div>
              <p style={{ maxWidth: 480, margin: '0 auto', lineHeight: 1.6, marginBottom: 20 }}>
                Create optimized content with real-time scoring on readability, SEO, originality, and tone of voice.
                Use AI tools to rephrase, compose, and get answers.
              </p>
              <button
                onClick={handleNewDocument}
                className="h-10 px-6 rounded-md bg-accent-primary text-white text-sm font-semibold hover:bg-accent-primary-hover transition-colors"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Plus size={16} /> Create New Document
              </button>
            </div>
          )}

          {/* Modals */}
          <RephraseModal
            isOpen={showRephraseModal}
            onClose={() => setShowRephraseModal(false)}
            selectedText={selectedText}
            onReplace={handleReplaceText}
            onInsertBelow={handleInsertBelow}
          />
          <ComposeModal
            isOpen={showComposeModal}
            onClose={() => setShowComposeModal(false)}
            onInsert={handleInsertContent}
            defaultKeywords={targetKeywords}
            defaultTone={targetTone}
          />
          <AskAiModal
            isOpen={showAskAiModal}
            onClose={() => setShowAskAiModal(false)}
            onInsert={handleInsertContent}
            currentContent={plainText}
            topic={title}
          />
        </main>
      </div>
    </>
  );
}

export default function WritingAssistantPage() {
  return (
    <AuthGuard>
      <WritingAssistantContent />
    </AuthGuard>
  );
}
