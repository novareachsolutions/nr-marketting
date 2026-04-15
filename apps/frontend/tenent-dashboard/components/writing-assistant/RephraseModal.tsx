import { useState } from 'react';
import { Modal } from '@/components/ui/Dialog';
import { useRephrase } from '@/hooks/useWritingAssistant';
import { Loader2, ArrowRight, Copy, Check } from 'lucide-react';
import type { RephraseMode } from '@/types/writing-assistant';

interface RephraseModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  onReplace: (text: string) => void;
  onInsertBelow: (text: string) => void;
}

const MODES: { key: RephraseMode; label: string; desc: string }[] = [
  { key: 'simplify', label: 'Simplify', desc: 'Simpler language, shorter sentences' },
  { key: 'expand', label: 'Expand', desc: 'Add more detail and explanation' },
  { key: 'rephrase', label: 'Rephrase', desc: 'Same meaning, different words' },
  { key: 'summarize', label: 'Summarize', desc: 'Condense to key points' },
];

export function RephraseModal({
  isOpen,
  onClose,
  selectedText,
  onReplace,
  onInsertBelow,
}: RephraseModalProps) {
  const [mode, setMode] = useState<RephraseMode>('rephrase');
  const [copied, setCopied] = useState(false);
  const rephrase = useRephrase();

  const handleRephrase = () => {
    rephrase.mutate({ text: selectedText, mode });
  };

  const handleCopy = () => {
    if (rephrase.data?.result) {
      navigator.clipboard.writeText(rephrase.data.result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    rephrase.reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Rephrase Text"
      footer={
        rephrase.data?.result ? (
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
              onClick={() => { onInsertBelow(rephrase.data!.result); handleClose(); }}
              className="h-9 px-4 rounded-md border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors"
            >
              Insert Below
            </button>
            <button
              onClick={() => { onReplace(rephrase.data!.result); handleClose(); }}
              className="h-9 px-4 rounded-md bg-accent-primary text-white text-sm font-semibold hover:bg-accent-primary-hover transition-colors"
            >
              Replace
            </button>
          </div>
        ) : undefined
      }
    >
      {/* Selected text preview */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase' }}>
          Selected Text
        </div>
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            maxHeight: 120,
            overflowY: 'auto',
          }}
        >
          {selectedText}
        </div>
      </div>

      {/* Mode buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            style={{
              padding: '10px 12px',
              border: `1px solid ${mode === m.key ? 'var(--accent-primary)' : 'var(--border-primary)'}`,
              borderRadius: 8,
              background: mode === m.key ? 'var(--accent-primary-light, rgba(34,197,94,0.08))' : 'var(--bg-card)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Generate button */}
      {!rephrase.data?.result && (
        <button
          onClick={handleRephrase}
          disabled={rephrase.isPending}
          className="h-10 w-full rounded-md bg-accent-primary text-white text-sm font-semibold hover:bg-accent-primary-hover transition-colors"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {rephrase.isPending ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Rephrasing...
            </>
          ) : (
            <>
              <ArrowRight size={15} /> Rephrase
            </>
          )}
        </button>
      )}

      {/* Result */}
      {rephrase.data?.result && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase' }}>
            Result
          </div>
          <div
            style={{
              padding: '10px 12px',
              background: 'rgba(34, 197, 94, 0.05)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--text-primary)',
            }}
          >
            {rephrase.data.result}
          </div>
        </div>
      )}

      {/* Error */}
      {rephrase.isError && (
        <div style={{ marginTop: 12, fontSize: 13, color: '#ef4444' }}>
          Failed to rephrase. Please try again.
        </div>
      )}
    </Modal>
  );
}
