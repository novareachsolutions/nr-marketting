import { useState } from 'react';
import { useAiSuggestions } from '@/hooks/useAiSuggestions';
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiInsightsProps {
  module: string;
  context: Record<string, any> | null;
}

export function AiInsights({ module, context }: AiInsightsProps) {
  const [expanded, setExpanded] = useState(true);
  const { data, isLoading, error } = useAiSuggestions(module, context);

  if (!context) return null;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-bg-card">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-hover transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-accent-primary-light flex items-center justify-center">
            <Sparkles size={14} className="text-accent-primary" />
          </div>
          <span className="text-sm font-semibold text-text-primary">AI Insights</span>
          {isLoading && (
            <span className="flex items-center gap-1.5 text-xs text-accent-primary">
              <Loader2 size={12} className="animate-spin" />
              Generating...
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-text-tertiary" />
        ) : (
          <ChevronDown size={16} className="text-text-tertiary" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {isLoading && (
            <div className="text-sm text-text-tertiary py-3">
              Analyzing your data and generating suggestions...
            </div>
          )}

          {error && !isLoading && (
            <div className="text-sm text-accent-danger py-3">
              Could not generate suggestions right now.
            </div>
          )}

          {data && data.suggestions.length > 0 && !isLoading && (
            <ul className="space-y-2.5 pt-1">
              {data.suggestions.map((suggestion: string, i: number) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-accent-primary-light text-accent-primary text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-text-secondary leading-relaxed">
                    {suggestion}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {data && data.suggestions.length === 0 && !isLoading && (
            <div className="text-sm text-text-tertiary py-3">
              No suggestions available for this data.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
