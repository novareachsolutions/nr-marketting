import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAddCompetitor } from '@/hooks/useProjects';
import { showSuccessToast, apiClient } from '@repo/shared-frontend';
import styles from './SuggestCompetitors.module.css';

interface SuggestCompetitorsProps {
  projectId: string;
  domain: string;
}

interface SuggestedCompetitor {
  domain: string;
  reason: string;
}

export function SuggestCompetitors({ projectId, domain }: SuggestCompetitorsProps) {
  const [suggestions, setSuggestions] = useState<SuggestedCompetitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addedDomains, setAddedDomains] = useState<Set<string>>(new Set());
  const [addingDomain, setAddingDomain] = useState<string | null>(null);

  const addCompetitor = useAddCompetitor();
  const queryClient = useQueryClient();

  const handleSuggest = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/ai-suggestions', {
        module: 'suggest-competitors',
        context: { domain, requestType: 'competitor-domains' },
      });
      const data = res.data.data;
      // Parse suggestions - expect [{domain, reason}] or string[]
      if (data.suggestions && Array.isArray(data.suggestions)) {
        const parsed: SuggestedCompetitor[] = data.suggestions.map((s: any) => {
          if (typeof s === 'string') {
            // Try to extract domain and reason from string like "example.com - reason here"
            const parts = s.split(' - ');
            if (parts.length >= 2) {
              return { domain: parts[0].trim().replace(/^https?:\/\//, '').replace(/^www\./, ''), reason: parts.slice(1).join(' - ').trim() };
            }
            // Try to extract just a domain from the string
            const domainMatch = s.match(/([a-z0-9-]+\.[a-z]{2,})/i);
            return { domain: domainMatch ? domainMatch[1] : s, reason: s };
          }
          return { domain: s.domain || s, reason: s.reason || '' };
        });
        setSuggestions(parsed);
      }
    } catch (err: any) {
      setError('Failed to get suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (competitorDomain: string) => {
    setAddingDomain(competitorDomain);
    try {
      await addCompetitor.mutateAsync({
        url: `/projects/${projectId}/competitors`,
        body: { domain: competitorDomain },
      });
      setAddedDomains((prev) => new Set(prev).add(competitorDomain));
      showSuccessToast('Added', `${competitorDomain} added as competitor`);
      queryClient.invalidateQueries({ queryKey: ['competitors', projectId] });
    } catch {
      // handled by global toast
    } finally {
      setAddingDomain(null);
    }
  };

  return (
    <div className={styles.container}>
      {suggestions.length === 0 && !loading && (
        <button className={styles.suggestBtn} onClick={handleSuggest} disabled={loading}>
          Suggest Competitors with AI
        </button>
      )}

      {loading && (
        <div className={styles.loading}>Finding competitors for {domain}...</div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {suggestions.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultsTitle}>Suggested Competitors</div>
          {suggestions.map((s, i) => (
            <div key={i} className={styles.row}>
              <div className={styles.rowInfo}>
                <span className={styles.rowDomain}>{s.domain}</span>
                {s.reason && <span className={styles.rowReason}>{s.reason}</span>}
              </div>
              {addedDomains.has(s.domain) ? (
                <span className={styles.addedBadge}>Added</span>
              ) : (
                <button
                  className={styles.addBtn}
                  onClick={() => handleAdd(s.domain)}
                  disabled={addingDomain === s.domain}
                >
                  {addingDomain === s.domain ? 'Adding...' : '+ Add'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
