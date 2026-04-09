import { ReactNode } from 'react';
import { HelpButton } from './HelpButton';
import { Badge } from './Badge';
import { cn } from '@/lib/utils';
import { Search, SlidersHorizontal } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  onHelpClick?: () => void;
  badge?: string;
  children?: ReactNode;
  className?: string;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}

export function PageHeader({
  title,
  onHelpClick,
  badge,
  children,
  className,
  showSearch,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search',
}: PageHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 mb-8 flex-wrap', className)}>
      <div className="flex items-center gap-3">
        <h1 className="text-[24px] font-bold text-text-primary m-0 tracking-tight">{title}</h1>
        {badge && (
          <Badge variant="default" size="lg">
            {badge}
          </Badge>
        )}
        {onHelpClick && <HelpButton onClick={onHelpClick} />}
      </div>
      <div className="flex items-center gap-3">
        {showSearch && (
          <div className="flex items-center gap-2 h-10 px-3 bg-bg-card border border-border rounded-lg">
            <Search size={16} className="text-text-tertiary flex-shrink-0" />
            <input
              type="text"
              value={searchValue || ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              className="bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-tertiary w-[160px]"
            />
            <SlidersHorizontal size={16} className="text-text-tertiary flex-shrink-0 cursor-pointer hover:text-text-primary transition-colors" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
