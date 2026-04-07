import { ReactNode } from 'react';
import { HelpButton } from './HelpButton';

interface PageHeaderProps {
  title: string;
  onHelpClick?: () => void;
  badge?: string;
  children?: ReactNode;
}

export function PageHeader({ title, onHelpClick, badge, children }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h1>
      {badge && (
        <span style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          background: 'var(--bg-tertiary)',
          padding: '4px 10px',
          borderRadius: 'var(--radius-full)',
        }}>
          {badge}
        </span>
      )}
      {onHelpClick && <HelpButton onClick={onHelpClick} />}
      {children}
    </div>
  );
}
