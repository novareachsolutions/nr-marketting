import { Injectable } from '@nestjs/common';

@Injectable()
export class SeoContentTemplateExportService {
  // Build a Word-compatible HTML document that Word opens as a .doc file.
  // This avoids adding a new dependency (docx/pizzip) while producing a
  // usable deliverable for writers.
  buildDocHtml(brief: any): string {
    const keywords: string[] = (brief.targetKeywords as string[]) || [];
    const semantic: string[] = (brief.semanticKeywords as string[]) || [];
    const backlinks: string[] = (brief.backlinkTargets as string[]) || [];
    const rivals: any[] = (brief.topRivals as any[]) || [];

    const rivalsHtml = rivals
      .map((r) => {
        const examples = (r.exampleSentences || [])
          .map((s: string) => `<li>${this.esc(s)}</li>`)
          .join('');
        return `
<div style="margin: 12px 0; padding: 10px; border-left: 3px solid #9ca3af;">
  <p style="margin: 0;"><strong>${r.rank}. ${this.esc(r.title || '')}</strong></p>
  <p style="margin: 4px 0; color: #4b5563; font-size: 11px;">${this.esc(r.url || '')}</p>
  <p style="margin: 6px 0;">${this.esc(r.snippet || '')}</p>
  <p style="margin: 4px 0; font-size: 11px; color: #6b7280;">Keyword occurrences: ${r.totalOccurrences || 0}</p>
  ${examples ? `<ul style="margin: 4px 0;">${examples}</ul>` : ''}
</div>`.trim();
      })
      .join('\n');

    const body = `
<h1>SEO Content Brief</h1>
<p><strong>Target keywords:</strong> ${keywords.map((k) => this.esc(k)).join(', ')}</p>
<p><strong>Country:</strong> ${this.esc(brief.country || 'US')}</p>

<h2>On-Page Recommendations</h2>
<p><strong>Title:</strong> ${this.esc(brief.titleSuggestion || '')}</p>
<p><strong>Meta description:</strong> ${this.esc(brief.metaSuggestion || '')}</p>
<p><strong>H1:</strong> ${this.esc(brief.h1Suggestion || '')}</p>

<h2>Content Requirements</h2>
<ul>
  <li><strong>Recommended word count:</strong> ${brief.recommendedWordCount} words</li>
  <li><strong>Target readability:</strong> ${brief.avgReadability}/100 (Flesch reading ease)</li>
</ul>

<h2>Semantic Keywords to Include</h2>
<ul>
  ${semantic.map((s) => `<li>${this.esc(s)}</li>`).join('\n  ')}
</ul>

<h2>Top 10 Competitors</h2>
${rivalsHtml}

<h2>Backlink Targets</h2>
<p>Try to acquire backlinks from the following domains:</p>
<ul>
  ${backlinks.map((d) => `<li>${this.esc(d)}</li>`).join('\n  ')}
</ul>
`.trim();

    return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>SEO Content Brief</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 12pt; color: #111827; }
  h1 { font-size: 20pt; color: #065f46; }
  h2 { font-size: 14pt; color: #065f46; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin-top: 18px; }
  ul { margin: 6px 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;
  }

  buildFileName(brief: any): string {
    const keywords: string[] = (brief.targetKeywords as string[]) || [];
    const slug = (keywords[0] || 'brief')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    return `seo-brief-${slug}.doc`;
  }

  private esc(text: string): string {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
