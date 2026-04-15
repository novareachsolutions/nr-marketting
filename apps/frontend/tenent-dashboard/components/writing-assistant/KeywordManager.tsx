import { useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';

interface KeywordManagerProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  plainText: string;
}

function getKeywordDensity(text: string, keyword: string): number {
  if (!text || !keyword) return 0;
  const words = text.toLowerCase().split(/\s+/);
  const kwWords = keyword.toLowerCase().split(/\s+/);
  if (words.length === 0) return 0;

  let count = 0;
  for (let i = 0; i <= words.length - kwWords.length; i++) {
    const slice = words.slice(i, i + kwWords.length).join(' ');
    if (slice === keyword.toLowerCase()) count++;
  }
  return (count * kwWords.length) / words.length * 100;
}

function getDensityColor(d: number): string {
  if (d >= 1 && d <= 3) return '#22c55e';
  if (d > 0 && d < 1) return '#eab308';
  if (d > 3) return '#f97316';
  return 'var(--text-tertiary)';
}

export function KeywordManager({ keywords, onChange, plainText }: KeywordManagerProps) {
  const [input, setInput] = useState('');

  const addKeyword = () => {
    const kw = input.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      onChange([...keywords, kw]);
    }
    setInput('');
  };

  const removeKeyword = (kw: string) => {
    onChange(keywords.filter((k) => k !== kw));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          placeholder="Add target keyword..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            padding: '6px 10px',
            border: '1px solid var(--border-primary)',
            borderRadius: 6,
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={addKeyword}
          disabled={!input.trim()}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--border-primary)',
            borderRadius: 6,
            background: input.trim() ? 'var(--accent-primary)' : 'var(--bg-card)',
            color: input.trim() ? '#fff' : 'var(--text-tertiary)',
            fontSize: 13,
            cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Plus size={13} /> Add
        </button>
      </div>

      {keywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {keywords.map((kw) => {
            const density = getKeywordDensity(plainText, kw);
            return (
              <div
                key={kw}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px 4px 10px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 20,
                  fontSize: 12,
                }}
              >
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{kw}</span>
                <span style={{ color: getDensityColor(density), fontWeight: 600, fontSize: 11 }}>
                  {density.toFixed(1)}%
                </span>
                <button
                  onClick={() => removeKeyword(kw)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
