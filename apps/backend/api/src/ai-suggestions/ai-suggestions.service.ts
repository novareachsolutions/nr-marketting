import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiSuggestionsService {
  private readonly logger = new Logger(AiSuggestionsService.name);
  private readonly openaiKey: string;
  private readonly hasOpenAI: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;
  }

  async getSuggestions(
    module: string,
    context: Record<string, any>,
  ): Promise<{ suggestions: string[] }> {
    if (!this.hasOpenAI) {
      throw new BadRequestException('OpenAI API key is not configured');
    }

    // Build cache key from module + stringified context
    const contextStr = JSON.stringify(context, Object.keys(context).sort());
    const cacheKey = `${module}|${this.simpleHash(contextStr)}`;

    // Check cache (7-day TTL)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const cached = await this.prisma.aiSuggestionsCache.findUnique({
      where: { cacheKey },
    });

    if (cached && cached.updatedAt > sevenDaysAgo) {
      return cached.data as unknown as { suggestions: string[] };
    }

    // For topic research and competitor suggestions, scrape the domain to understand the business
    if (module === 'topic-research' && context.domain) {
      const siteDescription = await this.scrapeDomainDescription(context.domain);
      if (siteDescription) {
        context = { ...context, siteDescription };
      }
    }

    if (module === 'suggest-competitors' && context.domain) {
      const siteDescription = await this.scrapeDomainDescription(context.domain);
      if (siteDescription) {
        context = { ...context, siteDescription };
      }
    }

    const systemPrompt = this.getSystemPrompt(module);
    const userPrompt = this.getUserPrompt(module, context);
    const model = (module === 'suggest-competitors' || module === 'topic-research') ? 'gpt-4o' : 'gpt-4o-mini';

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model,
          temperature: 0.5,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const content = response.data.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content);
      const suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 5)
        : [];

      const result = { suggestions };

      // Cache result
      await this.prisma.aiSuggestionsCache.upsert({
        where: { cacheKey },
        create: { cacheKey, data: result as any },
        update: { data: result as any },
      });

      return result;
    } catch (err: any) {
      this.logger.error(`AI suggestions error: ${err?.message}`);
      throw new BadRequestException('Failed to generate suggestions.');
    }
  }

  private getSystemPrompt(module: string): string {
    const prompts: Record<string, string> = {
      'domain-overview': `You are an SEO consultant analyzing a domain overview. Based on the metrics provided, give 3-5 specific, actionable suggestions to improve the domain's SEO performance. Focus on authority, traffic growth, and backlink strategy.`,
      'organic-rankings': `You are an SEO consultant analyzing organic rankings data. Based on the keywords, positions, and changes, give 3-5 specific, actionable suggestions to improve organic rankings. Focus on position improvements, content optimization, and SERP feature opportunities.`,
      'top-pages': `You are an SEO consultant analyzing top pages data. Based on the page performance metrics, give 3-5 specific, actionable suggestions to improve page-level SEO. Focus on content optimization, internal linking, and traffic growth.`,
      'compare-domains': `You are an SEO consultant analyzing a domain comparison. Based on the competitive metrics, give 3-5 specific, actionable suggestions highlighting competitive advantages, weaknesses, and opportunities.`,
      'keyword-gap': `You are an SEO consultant analyzing keyword gaps. Based on the gap analysis, give 3-5 specific, actionable suggestions for closing keyword gaps. Focus on missing keywords, content creation priorities, and quick wins.`,
      'backlink-gap': `You are an SEO consultant analyzing backlink gaps. Based on the referring domain analysis, give 3-5 specific, actionable suggestions for link building outreach. Focus on high-authority prospects and outreach strategy.`,
      'keyword-research': `You are an SEO consultant analyzing keyword research data. Based on the keyword metrics, give 3-5 specific, actionable suggestions for keyword targeting strategy. Focus on difficulty, intent, and content planning.`,
      'topic-research-insights': `You are an SEO content strategist analyzing topic research results. Based on the topic clusters, their search volumes, difficulty scores, and efficiency ratings, give 3-5 specific, actionable suggestions for content planning. Focus on which topics to prioritize, content gaps, and how to structure topic clusters for maximum organic traffic.`,
      'topic-research': `You are an SEO content strategist specializing in topic research and content planning. Given a domain and its competitors, suggest 5 high-potential topic clusters that the domain should create content about. For each topic, include the main topic name, 3-4 specific related keywords to target, and a brief reason why this topic is a good fit for the domain. Focus on topics with high search volume potential and low to medium competition. Return JSON with this EXACT structure: {"suggestions":[{"topic":"main topic name","keywords":["keyword 1","keyword 2","keyword 3"],"reason":"Brief reason why this topic fits the domain"}]}`,
      'suggest-competitors': `You are an SEO competitive analyst. You will be given a domain along with a description of what the website actually does (scraped from the site). Use this description to understand the business's exact products, services, and target market. Then suggest 5 competitor domains that DIRECTLY compete for the same customers and keywords in the same specific niche. IMPORTANT: Suggest competitors that are at a SIMILAR business level and scale — NOT industry giants or market leaders. The competitors should be businesses realistically fighting for the same customers and search rankings. Do NOT suggest generic or loosely related sites. Return JSON with this EXACT structure: {"suggestions":[{"domain":"competitor1.com","reason":"Brief reason why they compete","authorityScore":35,"organicTraffic":12000,"organicKeywords":850,"backlinks":3200}]}. For each competitor, estimate realistic SEO metrics based on your knowledge. authorityScore is 0-100, organicTraffic is estimated monthly visits, organicKeywords is number of ranking keywords, backlinks is total backlink count. Make metrics realistic for similar-scale businesses.`,
    };
    return (prompts[module] || prompts['domain-overview']) +
      (module === 'suggest-competitors' || module === 'topic-research' ? '' : ` Return JSON: {"suggestions":["<suggestion 1>","<suggestion 2>","<suggestion 3>"]}. Each suggestion should be 1-2 sentences, specific, and actionable. Reference actual numbers from the data.`);
  }

  private getUserPrompt(module: string, context: Record<string, any>): string {
    if (module === 'topic-research') {
      const domain = context.domain || '';
      const competitors = context.competitors?.length > 0 ? context.competitors.join(', ') : 'none provided';
      const siteDescription = context.siteDescription || 'No description available';
      return `Suggest topic clusters for: ${domain}\n\nSite description:\n${siteDescription}\n\nCompetitors: ${competitors}\n\nSuggest 5 topic clusters this domain should create content about to improve organic traffic.`;
    }
    if (module === 'suggest-competitors') {
      const domain = context.domain || '';
      const siteDescription = context.siteDescription || 'No description available';
      return `Find direct competitors for: ${domain}\n\nHere is what this website does (scraped from the site):\n${siteDescription}\n\nBased on this, suggest 5 domains that compete in the exact same market and niche.`;
    }
    return `Module: ${module}\nData:\n${JSON.stringify(context, null, 0)}`;
  }

  private async scrapeDomainDescription(domain: string): Promise<string> {
    try {
      const url = `https://${domain.replace(/^https?:\/\//, '').replace(/^www\./, '')}`;
      const response = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NRSEOBot/1.0)' },
        maxRedirects: 3,
      });

      const html: string = response.data;

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // Extract meta description
      const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i)
        || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["'][^>]*>/i);
      const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : '';

      // Extract og:description
      const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i)
        || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*property=["']og:description["'][^>]*>/i);
      const ogDesc = ogDescMatch ? ogDescMatch[1].trim() : '';

      // Extract h1 tags
      const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
      const h1s = h1Matches
        .slice(0, 3)
        .map((h) => h.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean);

      const parts: string[] = [];
      if (title) parts.push(`Title: ${title}`);
      if (metaDesc) parts.push(`Description: ${metaDesc}`);
      if (ogDesc && ogDesc !== metaDesc) parts.push(`OG Description: ${ogDesc}`);
      if (h1s.length > 0) parts.push(`Headings: ${h1s.join(', ')}`);

      return parts.join('\n') || '';
    } catch (err: any) {
      this.logger.warn(`Failed to scrape ${domain}: ${err?.message}`);
      return '';
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return String(Math.abs(hash));
  }
}
