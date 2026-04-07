import { useState } from 'react';
import { useAiSuggestions } from '@/hooks/useAiSuggestions';
import styles from './AiInsights.module.css';

interface AiInsightsProps {
  module: string;
  context: Record<string, any> | null;
}

export function AiInsights({ module, context }: AiInsightsProps) {
  const [expanded, setExpanded] = useState(true);
  const { data, isLoading, error } = useAiSuggestions(module, context);

  if (!context) return null;

  return (
    <div className={styles.container}>
      <button className={styles.header} onClick={() => setExpanded(!expanded)}>
        <div className={styles.headerLeft}>
          <span className={styles.icon}>AI</span>
          <span className={styles.title}>AI Insights</span>
          {isLoading && <span className={styles.loading}>Generating...</span>}
        </div>
        <span className={styles.toggle}>{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className={styles.body}>
          {isLoading && (
            <div className={styles.loadingState}>Analyzing your data and generating suggestions...</div>
          )}

          {error && !isLoading && (
            <div className={styles.errorState}>Could not generate suggestions right now.</div>
          )}

          {data && data.suggestions.length > 0 && !isLoading && (
            <ul className={styles.list}>
              {data.suggestions.map((suggestion, i) => (
                <li key={i} className={styles.item}>
                  <span className={styles.bullet}>{i + 1}</span>
                  <span className={styles.text}>{suggestion}</span>
                </li>
              ))}
            </ul>
          )}

          {data && data.suggestions.length === 0 && !isLoading && (
            <div className={styles.emptyState}>No suggestions available for this data.</div>
          )}
        </div>
      )}
    </div>
  );
}
