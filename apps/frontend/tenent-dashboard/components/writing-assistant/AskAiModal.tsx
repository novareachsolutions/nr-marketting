import { useState } from 'react';
import { Modal } from '@/components/ui/Dialog';
import { useAskAi } from '@/hooks/useWritingAssistant';
import { Loader2, MessageCircle, Copy, Check, Send } from 'lucide-react';

interface AskAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
  currentContent?: string;
  topic?: string;
}

interface QA {
  question: string;
  answer: string;
}

export function AskAiModal({
  isOpen,
  onClose,
  onInsert,
  currentContent,
  topic,
}: AskAiModalProps) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<QA[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const askAi = useAskAi();

  const handleAsk = () => {
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion('');
    askAi.mutate(
      { question: q, topic, currentContent },
      {
        onSuccess: (data) => {
          setHistory((prev) => [...prev, { question: q, answer: data.answer }]);
        },
      },
    );
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleClose = () => {
    setHistory([]);
    setQuestion('');
    askAi.reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Ask AI">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* History */}
        {history.length > 0 && (
          <div
            style={{
              maxHeight: 300,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {history.map((qa, i) => (
              <div key={i}>
                {/* Question */}
                <div
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-primary)',
                    borderRadius: '10px 10px 10px 2px',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    marginBottom: 6,
                  }}
                >
                  {qa.question}
                </div>
                {/* Answer */}
                <div
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(34, 197, 94, 0.05)',
                    border: '1px solid rgba(34, 197, 94, 0.15)',
                    borderRadius: '10px 10px 2px 10px',
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: 'var(--text-primary)',
                    position: 'relative',
                  }}
                >
                  {qa.answer}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button
                      onClick={() => handleCopy(qa.answer, i)}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {copied === i ? <Check size={11} /> : <Copy size={11} />}
                      {copied === i ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => { onInsert(qa.answer); handleClose(); }}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                      }}
                    >
                      Insert
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {askAi.isPending && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              fontSize: 13,
              color: 'var(--text-tertiary)',
            }}
          >
            <Loader2 size={15} className="animate-spin" /> Thinking...
          </div>
        )}

        {/* Input */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Ask a question about your topic..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            style={{
              flex: 1,
              padding: '10px 12px',
              border: '1px solid var(--border-primary)',
              borderRadius: 8,
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <button
            onClick={handleAsk}
            disabled={!question.trim() || askAi.isPending}
            className="h-10 px-4 rounded-md bg-accent-primary text-white text-sm font-semibold hover:bg-accent-primary-hover transition-colors disabled:opacity-50"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Send size={14} />
          </button>
        </div>

        {askAi.isError && (
          <div style={{ fontSize: 13, color: '#ef4444' }}>
            Failed to get answer. Please try again.
          </div>
        )}

        {/* Empty state */}
        {history.length === 0 && !askAi.isPending && (
          <div
            style={{
              textAlign: 'center',
              padding: '20px 0',
              color: 'var(--text-tertiary)',
              fontSize: 13,
            }}
          >
            <MessageCircle size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            <div>Ask anything about your content or topic.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              e.g. &ldquo;What are the main benefits of this approach?&rdquo;
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
