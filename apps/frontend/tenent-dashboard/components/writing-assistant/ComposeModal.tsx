import { useState } from 'react';
import { Modal } from '@/components/ui/Dialog';
import { useCompose } from '@/hooks/useWritingAssistant';
import { Loader2, PenTool, Copy, Check } from 'lucide-react';
import type { ToneType, ContentType } from '@/types/writing-assistant';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
  defaultKeywords?: string[];
  defaultTone?: string;
}

export function ComposeModal({
  isOpen,
  onClose,
  onInsert,
  defaultKeywords = [],
  defaultTone = 'neutral',
}: ComposeModalProps) {
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState(defaultKeywords.join(', '));
  const [tone, setTone] = useState<ToneType>(defaultTone as ToneType);
  const [contentType, setContentType] = useState<ContentType>('paragraph');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [copied, setCopied] = useState(false);
  const compose = useCompose();

  const handleCompose = () => {
    compose.mutate({
      topic,
      keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
      tone,
      contentType,
      length,
    });
  };

  const handleCopy = () => {
    if (compose.data?.content) {
      navigator.clipboard.writeText(compose.data.content.replace(/<[^>]+>/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    compose.reset();
    onClose();
  };

  const selectStyle: React.CSSProperties = {
    padding: '8px 10px',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Compose Content"
      footer={
        compose.data?.content ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCopy}
              className="h-9 px-4 rounded-md border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={() => { onInsert(compose.data!.content); handleClose(); }}
              className="h-9 px-4 rounded-md bg-accent-primary text-white text-sm font-semibold hover:bg-accent-primary-hover transition-colors"
            >
              Insert into Editor
            </button>
          </div>
        ) : undefined
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Topic */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            Topic *
          </label>
          <input
            type="text"
            placeholder="e.g. Benefits of organic SEO"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={{ ...selectStyle, width: '100%' }}
          />
        </div>

        {/* Keywords */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            Keywords (comma-separated)
          </label>
          <input
            type="text"
            placeholder="e.g. organic seo, search rankings, content strategy"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            style={{ ...selectStyle, width: '100%' }}
          />
        </div>

        {/* Options row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Tone
            </label>
            <select value={tone} onChange={(e) => setTone(e.target.value as ToneType)} style={{ ...selectStyle, width: '100%' }}>
              <option value="formal">Formal</option>
              <option value="neutral">Neutral</option>
              <option value="casual">Casual</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Type
            </label>
            <select value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)} style={{ ...selectStyle, width: '100%' }}>
              <option value="paragraph">Paragraph</option>
              <option value="outline">Outline</option>
              <option value="intro">Introduction</option>
              <option value="conclusion">Conclusion</option>
              <option value="listicle">Listicle</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Length
            </label>
            <select value={length} onChange={(e) => setLength(e.target.value as any)} style={{ ...selectStyle, width: '100%' }}>
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </div>
        </div>

        {/* Generate button */}
        {!compose.data?.content && (
          <button
            onClick={handleCompose}
            disabled={compose.isPending || !topic.trim()}
            className="h-10 w-full rounded-md bg-accent-primary text-white text-sm font-semibold hover:bg-accent-primary-hover transition-colors disabled:opacity-50"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {compose.isPending ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Generating...
              </>
            ) : (
              <>
                <PenTool size={15} /> Generate Content
              </>
            )}
          </button>
        )}

        {/* Result */}
        {compose.data?.content && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase' }}>
              Generated Content
            </div>
            <div
              style={{
                padding: '12px',
                background: 'rgba(34, 197, 94, 0.05)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--text-primary)',
                maxHeight: 250,
                overflowY: 'auto',
              }}
              dangerouslySetInnerHTML={{ __html: compose.data.content }}
            />
          </div>
        )}

        {compose.isError && (
          <div style={{ fontSize: 13, color: '#ef4444' }}>
            Failed to generate content. Please try again.
          </div>
        )}
      </div>
    </Modal>
  );
}
