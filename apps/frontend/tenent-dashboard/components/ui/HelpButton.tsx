import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpButtonProps {
  onClick: () => void;
  className?: string;
}

export function HelpButton({ onClick, className }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-7 w-7 rounded-full flex items-center justify-center',
        'border border-border bg-bg-card text-text-tertiary',
        'hover:bg-bg-hover hover:text-text-primary hover:border-border-focus',
        'transition-all duration-fast',
        className
      )}
      title="How to use this tool"
    >
      <HelpCircle size={14} />
    </button>
  );
}
