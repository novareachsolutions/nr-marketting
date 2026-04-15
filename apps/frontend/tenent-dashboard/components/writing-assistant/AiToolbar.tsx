import { RefreshCw, PenTool, MessageCircle } from 'lucide-react';

interface AiToolbarProps {
  selectedText: string;
  onRephrase: () => void;
  onCompose: () => void;
  onAskAi: () => void;
}

export function AiToolbar({
  selectedText,
  onRephrase,
  onCompose,
  onAskAi,
}: AiToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '10px 16px',
        border: '1px solid var(--border-primary)',
        borderRadius: 10,
        background: 'var(--bg-card)',
      }}
    >
      <button
        onClick={onRephrase}
        disabled={!selectedText}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 14px',
          border: '1px solid var(--border-primary)',
          borderRadius: 6,
          background: selectedText ? 'var(--bg-primary)' : 'var(--bg-card)',
          color: selectedText ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontSize: 13,
          fontWeight: 500,
          cursor: selectedText ? 'pointer' : 'default',
          opacity: selectedText ? 1 : 0.5,
        }}
      >
        <RefreshCw size={14} />
        Rephrase{selectedText ? ` (${selectedText.split(/\s+/).length} words)` : ''}
      </button>

      <button
        onClick={onCompose}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 14px',
          border: '1px solid var(--border-primary)',
          borderRadius: 6,
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        <PenTool size={14} />
        Compose
      </button>

      <button
        onClick={onAskAi}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 14px',
          border: '1px solid var(--border-primary)',
          borderRadius: 6,
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        <MessageCircle size={14} />
        Ask AI
      </button>
    </div>
  );
}
