import { ReactNode } from 'react';
import { HelpButton } from './HelpButton';
import { Badge } from './Badge';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  onHelpClick?: () => void;
  badge?: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, onHelpClick, badge, children, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3 mb-6 flex-wrap', className)}>
      <h1 className="text-[22px] font-bold text-text-primary m-0">{title}</h1>
      {badge && (
        <Badge variant="default" size="lg">
          {badge}
        </Badge>
      )}
      {onHelpClick && <HelpButton onClick={onHelpClick} />}
      {children}
    </div>
  );
}
