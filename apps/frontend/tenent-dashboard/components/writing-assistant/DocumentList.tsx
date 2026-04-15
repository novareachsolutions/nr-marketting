import { FileText, Trash2, Clock, BarChart3 } from 'lucide-react';
import type { WritingDocumentListItem } from '@/types/writing-assistant';

interface DocumentListProps {
  documents: WritingDocumentListItem[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  activeId?: string | null;
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'var(--text-tertiary)';
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function DocumentList({
  documents,
  onSelect,
  onDelete,
  activeId,
}: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '32px 16px',
          color: 'var(--text-tertiary)',
          fontSize: 13,
        }}
      >
        <FileText size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
        <div>No documents yet.</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>Create one to get started.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {documents.map((doc) => (
        <div
          key={doc.id}
          onClick={() => onSelect(doc.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            border: `1px solid ${activeId === doc.id ? 'var(--accent-primary)' : 'var(--border-primary)'}`,
            borderRadius: 8,
            background: activeId === doc.id ? 'rgba(34, 197, 94, 0.05)' : 'var(--bg-card)',
            cursor: 'pointer',
          }}
        >
          <FileText size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {doc.title}
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Clock size={10} /> {formatDate(doc.updatedAt)}
              </span>
              <span>{doc.wordCount} words</span>
            </div>
          </div>

          {doc.overallScore !== null && (
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: getScoreColor(doc.overallScore),
                minWidth: 28,
                textAlign: 'right',
              }}
            >
              {Math.round(doc.overallScore)}
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(doc.id);
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              flexShrink: 0,
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
