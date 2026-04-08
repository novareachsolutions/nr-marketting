import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAddCompetitor } from '@/hooks/useProjects';
import { showSuccessToast, apiClient } from '@repo/shared-frontend';
import { Sparkles, Plus, Check, Loader2, Globe, TrendingUp, Key, Link2 } from 'lucide-react';
import { Button } from './Button';
import { Badge } from './Badge';

interface SuggestCompetitorsProps {
  projectId: string;
  domain: string;
}

interface SuggestedCompetitor {
  domain: string;
  reason: string;
  authorityScore: number | null;
  organicTraffic: number | null;
  organicKeywords: number | null;
  backlinks: number | null;
}

function formatNumber(num: number | null): string {
  if (num == null) return '—';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
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
      if (data.suggestions && Array.isArray(data.suggestions)) {
        const parsed: SuggestedCompetitor[] = data.suggestions.map((s: any) => {
          if (typeof s === 'string') {
            const parts = s.split(' - ');
            const d = parts[0]?.trim().replace(/^https?:\/\//, '').replace(/^www\./, '') || s;
            return {
              domain: d,
              reason: parts.length >= 2 ? parts.slice(1).join(' - ').trim() : '',
              authorityScore: null,
              organicTraffic: null,
              organicKeywords: null,
              backlinks: null,
            };
          }
          return {
            domain: (s.domain || '').replace(/^https?:\/\//, '').replace(/^www\./, ''),
            reason: s.reason || '',
            authorityScore: s.authorityScore ?? null,
            organicTraffic: s.organicTraffic ?? null,
            organicKeywords: s.organicKeywords ?? null,
            backlinks: s.backlinks ?? null,
          };
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
    <div className="space-y-3">
      {suggestions.length === 0 && !loading && (
        <Button variant="secondary" onClick={handleSuggest} disabled={loading}>
          <Sparkles size={14} />
          Suggest Competitors with AI
        </Button>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-text-secondary py-3">
          <Loader2 size={14} className="animate-spin text-accent-primary" />
          Finding competitors for {domain}...
        </div>
      )}

      {error && (
        <div className="text-sm text-accent-danger py-2">{error}</div>
      )}

      {suggestions.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-bg-secondary flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">
              Suggested Competitors
            </span>
            <Button variant="ghost" size="sm" onClick={handleSuggest} disabled={loading}>
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Refresh
            </Button>
          </div>
          <div className="divide-y divide-border">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="px-4 py-3 hover:bg-bg-hover transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-sm font-medium text-text-primary truncate">
                      {s.domain}
                    </span>
                    {s.reason && (
                      <span className="text-xs text-text-tertiary line-clamp-2">
                        {s.reason}
                      </span>
                    )}
                  </div>
                  {addedDomains.has(s.domain) ? (
                    <Badge variant="success" size="sm">
                      <Check size={10} className="mr-0.5" />
                      Added
                    </Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAdd(s.domain)}
                      disabled={addingDomain === s.domain}
                    >
                      {addingDomain === s.domain ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Plus size={12} />
                      )}
                      {addingDomain === s.domain ? 'Adding...' : 'Add'}
                    </Button>
                  )}
                </div>

                {(s.authorityScore != null || s.organicTraffic != null || s.organicKeywords != null || s.backlinks != null) && (
                  <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/50">
                    {s.authorityScore != null && (
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <Globe size={11} className="text-accent-primary" />
                        <span className="font-medium">{s.authorityScore}</span>
                        <span className="text-text-tertiary">Authority</span>
                      </div>
                    )}
                    {s.organicTraffic != null && (
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <TrendingUp size={11} className="text-green-500" />
                        <span className="font-medium">{formatNumber(s.organicTraffic)}</span>
                        <span className="text-text-tertiary">Visitors</span>
                      </div>
                    )}
                    {s.organicKeywords != null && (
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <Key size={11} className="text-yellow-500" />
                        <span className="font-medium">{formatNumber(s.organicKeywords)}</span>
                        <span className="text-text-tertiary">Keywords</span>
                      </div>
                    )}
                    {s.backlinks != null && (
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <Link2 size={11} className="text-purple-500" />
                        <span className="font-medium">{formatNumber(s.backlinks)}</span>
                        <span className="text-text-tertiary">Backlinks</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
