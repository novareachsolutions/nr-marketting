import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface ErrorRetryProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorRetry({ message, onRetry, className }: ErrorRetryProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 p-8',
        'bg-bg-card rounded-lg border border-border text-center',
        className
      )}
    >
      <div className="h-10 w-10 rounded-full bg-accent-danger-light flex items-center justify-center">
        <AlertTriangle size={18} className="text-accent-danger" />
      </div>
      <p className="text-sm text-accent-danger">
        {message || 'Something went wrong. Please try again.'}
      </p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
