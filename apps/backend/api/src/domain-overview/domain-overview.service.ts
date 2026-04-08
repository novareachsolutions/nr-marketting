import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

interface DomainOverviewData {
  domain: string;
  country: string;
  authorityScore: number | null;
  authorityTrend: number[] | null;
  organicKeywords: number | null;
  organicTraffic: number | null;
  organicTrafficCost: number | null;
  organicTrafficTrend: { date: string; traffic: number }[] | null;
  paidKeywords: number | null;
  paidTraffic: number | null;
  paidTrafficCost: number | null;
  totalBacklinks: number | null;
  referringDomains: number | null;
  followBacklinks: number | null;
  nofollowBacklinks: number | null;
  intentDistribution: {
    informational: number;
    navigational: number;
    commercial: number;
    transactional: number;
  } | null;
  positionDistribution: {
    top3: number;
    pos4_10: number;
    pos11_20: number;
    pos21_50: number;
    pos51_100: number;
  } | null;
  topOrganicKeywords: {
    keyword: string;
    position: number;
    volume: number;
    trafficPercent: number;
    url: string;
  }[] | null;
  topOrganicPages: {
    url: string;
    traffic: number;
    keywords: number;
  }[] | null;
  topCompetitors: {
    domain: string;
    commonKeywords: number;
    organicKeywords: number;
    organicTraffic: number;
  }[] | null;
  countryDistribution: {
    country: string;
    trafficShare: number;
  }[] | null;
}

@Injectable()
export class DomainOverviewService {
  private readonly logger = new Logger(DomainOverviewService.name);
  private readonly openaiKey: string;
  private readonly hasOpenAI: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;

    if (!this.hasOpenAI) {
      this.logger.warn(
        'OpenAI not configured — using mock data for domain overview',
      );
    }
  }

  // ─── MAIN ENTRY POINT ────────────────────────────────────

  async getDomainOverview(
    domain: string,
    country: string,
    userId: string,
  ): Promise<DomainOverviewData> {
    const normalized = this.normalizeDomain(domain);

    if (!normalized) {
      throw new BadRequestException('Invalid domain');
    }

    // Check cache (7-day TTL)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const cached = await this.prisma.domainOverviewCache.findUnique({
      where: { domain_country: { domain: normalized, country } },
    });

    if (cached && cached.updatedAt > sevenDaysAgo) {
      return this.mapCacheToResponse(cached, normalized, country);
    }

    // Fetch from OpenAI or use mock
    let data: DomainOverviewData;
    if (this.hasOpenAI) {
      data = await this.fetchFromOpenAI(normalized, country);
    } else {
      data = this.getMockDomainOverview(normalized, country);
    }

    // Upsert cache
    await this.prisma.domainOverviewCache.upsert({
      where: { domain_country: { domain: normalized, country } },
      create: {
        domain: normalized,
        country,
        authorityScore: data.authorityScore,
        authorityTrend: data.authorityTrend as any,
        organicKeywords: data.organicKeywords,
        organicTraffic: data.organicTraffic,
        organicTrafficCost: data.organicTrafficCost,
        organicTrafficTrend: data.organicTrafficTrend as any,
        paidKeywords: data.paidKeywords,
        paidTraffic: data.paidTraffic,
        paidTrafficCost: data.paidTrafficCost,
        totalBacklinks: data.totalBacklinks,
        referringDomains: data.referringDomains,
        followBacklinks: data.followBacklinks,
        nofollowBacklinks: data.nofollowBacklinks,
        intentDistribution: data.intentDistribution as any,
        positionDistribution: data.positionDistribution as any,
        topOrganicKeywords: data.topOrganicKeywords as any,
        topOrganicPages: data.topOrganicPages as any,
        topCompetitors: data.topCompetitors as any,
        countryDistribution: data.countryDistribution as any,
      },
      update: {
        authorityScore: data.authorityScore,
        authorityTrend: data.authorityTrend as any,
        organicKeywords: data.organicKeywords,
        organicTraffic: data.organicTraffic,
        organicTrafficCost: data.organicTrafficCost,
        organicTrafficTrend: data.organicTrafficTrend as any,
        paidKeywords: data.paidKeywords,
        paidTraffic: data.paidTraffic,
        paidTrafficCost: data.paidTrafficCost,
        totalBacklinks: data.totalBacklinks,
        referringDomains: data.referringDomains,
        followBacklinks: data.followBacklinks,
        nofollowBacklinks: data.nofollowBacklinks,
        intentDistribution: data.intentDistribution as any,
        positionDistribution: data.positionDistribution as any,
        topOrganicKeywords: data.topOrganicKeywords as any,
        topOrganicPages: data.topOrganicPages as any,
        topCompetitors: data.topCompetitors as any,
        countryDistribution: data.countryDistribution as any,
      },
    });

    // Increment usage
    await this.incrementUsage(userId);

    return data;
  }

  // ─── OPENAI FETCH ─────────────────────────────────────────

  private async fetchFromOpenAI(
    domain: string,
    country: string,
  ): Promise<DomainOverviewData> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are an SEO domain analyst. Given a domain and country, estimate realistic domain overview metrics based on your knowledge. Return ONLY valid JSON with this exact structure:
{
  "authorityScore": <0-100 integer, domain authority estimate>,
  "authorityTrend": [<6 integers, authority scores for last 6 months, oldest first>],
  "organicKeywords": <integer, estimated number of ranking keywords>,
  "organicTraffic": <integer, estimated monthly organic visits>,
  "organicTrafficCost": <float, estimated $ value of organic traffic>,
  "organicTrafficTrend": [{"date": "YYYY-MM", "traffic": <integer>}] for last 12 months,
  "paidKeywords": <integer, estimated paid keywords>,
  "paidTraffic": <integer, estimated monthly paid visits>,
  "paidTrafficCost": <float, estimated monthly ad spend>,
  "totalBacklinks": <integer>,
  "referringDomains": <integer>,
  "followBacklinks": <integer>,
  "nofollowBacklinks": <integer>,
  "intentDistribution": {"informational": <int>, "navigational": <int>, "commercial": <int>, "transactional": <int>} (percentages summing to 100),
  "positionDistribution": {"top3": <int>, "pos4_10": <int>, "pos11_20": <int>, "pos21_50": <int>, "pos51_100": <int>} (keyword counts),
  "topOrganicKeywords": [{"keyword": "<str>", "position": <1-100>, "volume": <int>, "trafficPercent": <float 0-100>, "url": "<path>"}] (top 10),
  "topOrganicPages": [{"url": "<path>", "traffic": <int>, "keywords": <int>}] (top 10),
  "topCompetitors": [{"domain": "<str>", "commonKeywords": <int>, "organicKeywords": <int>, "organicTraffic": <int>}] (top 10),
  "countryDistribution": [{"country": "<2-letter code>", "trafficShare": <float 0-100>}] (top 5 countries)
}
Base your estimates on real-world knowledge. Be realistic. For well-known domains provide accurate-ish data. For unknown domains provide conservative estimates. Use the country for the primary market context.`,
            },
            {
              role: 'user',
              content: `Domain: "${domain}"\nCountry: ${country}`,
            },
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

      return {
        domain,
        country,
        authorityScore: parsed.authorityScore ?? null,
        authorityTrend: Array.isArray(parsed.authorityTrend) ? parsed.authorityTrend : null,
        organicKeywords: parsed.organicKeywords ?? null,
        organicTraffic: parsed.organicTraffic ?? null,
        organicTrafficCost: parsed.organicTrafficCost ?? null,
        organicTrafficTrend: Array.isArray(parsed.organicTrafficTrend) ? parsed.organicTrafficTrend : null,
        paidKeywords: parsed.paidKeywords ?? null,
        paidTraffic: parsed.paidTraffic ?? null,
        paidTrafficCost: parsed.paidTrafficCost ?? null,
        totalBacklinks: parsed.totalBacklinks ?? null,
        referringDomains: parsed.referringDomains ?? null,
        followBacklinks: parsed.followBacklinks ?? null,
        nofollowBacklinks: parsed.nofollowBacklinks ?? null,
        intentDistribution: parsed.intentDistribution ?? null,
        positionDistribution: parsed.positionDistribution ?? null,
        topOrganicKeywords: Array.isArray(parsed.topOrganicKeywords) ? parsed.topOrganicKeywords : null,
        topOrganicPages: Array.isArray(parsed.topOrganicPages) ? parsed.topOrganicPages : null,
        topCompetitors: Array.isArray(parsed.topCompetitors) ? parsed.topCompetitors : null,
        countryDistribution: Array.isArray(parsed.countryDistribution) ? parsed.countryDistribution : null,
      };
    } catch (err) {
      this.logger.error(`OpenAI domain overview error: ${err}`);
      return this.getMockDomainOverview(domain, country);
    }
  }

  // ─── MOCK DATA ────────────────────────────────────────────

  private getMockDomainOverview(
    domain: string,
    country: string,
  ): DomainOverviewData {
    const h = this.simpleHash(domain);
    const authorityScore = 10 + (h % 80);
    const organicKeywords = 500 + (h % 50000);
    const organicTraffic = 1000 + (h % 500000);
    const totalBacklinks = 100 + (h % 200000);

    // Generate 12-month traffic trend
    const organicTrafficTrend: { date: string; traffic: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const variation = 1 + Math.sin(i * 0.5) * 0.2;
      organicTrafficTrend.push({
        date: month,
        traffic: Math.round(organicTraffic * variation),
      });
    }

    // Authority trend (6 months)
    const authorityTrend: number[] = [];
    for (let i = 5; i >= 0; i--) {
      authorityTrend.push(Math.max(1, authorityScore - i * 2 + Math.round(Math.sin(i) * 3)));
    }

    // Top organic keywords
    const kwPrefixes = ['best', 'how to', 'what is', 'guide', 'review', 'top', 'free', 'online', 'tips', 'tutorial'];
    const domainWord = domain.replace(/\.(com|org|net|io|co|au|uk)$/i, '').replace(/^www\./, '').replace(/[-_.]/g, ' ');
    const topOrganicKeywords = kwPrefixes.map((prefix, i) => {
      const kh = this.simpleHash(`${domain}-kw-${i}`);
      return {
        keyword: `${prefix} ${domainWord}`.trim(),
        position: 1 + (kh % 20),
        volume: 500 + (kh % 20000),
        trafficPercent: parseFloat((15 - i * 1.2).toFixed(1)),
        url: `/${prefix.replace(/\s/g, '-')}`,
      };
    });

    // Top organic pages
    const pagePaths = ['/', '/blog', '/about', '/services', '/pricing', '/contact', '/features', '/docs', '/faq', '/products'];
    const topOrganicPages = pagePaths.map((path, i) => {
      const ph = this.simpleHash(`${domain}-page-${i}`);
      return {
        url: path,
        traffic: Math.round(organicTraffic * (0.25 - i * 0.02)),
        keywords: 10 + (ph % 500),
      };
    });

    // Competitors
    const compDomains = ['competitor1.com', 'competitor2.com', 'competitor3.com', 'rival-site.com', 'similar-brand.com'];
    const topCompetitors = compDomains.map((cd, i) => {
      const ch = this.simpleHash(`${domain}-comp-${i}`);
      return {
        domain: cd,
        commonKeywords: 100 + (ch % 5000),
        organicKeywords: 1000 + (ch % 30000),
        organicTraffic: 2000 + (ch % 200000),
      };
    });

    return {
      domain,
      country,
      authorityScore,
      authorityTrend,
      organicKeywords,
      organicTraffic,
      organicTrafficCost: parseFloat((organicTraffic * 0.5).toFixed(2)),
      organicTrafficTrend,
      paidKeywords: Math.round(organicKeywords * 0.1),
      paidTraffic: Math.round(organicTraffic * 0.05),
      paidTrafficCost: parseFloat((organicTraffic * 0.02).toFixed(2)),
      totalBacklinks,
      referringDomains: Math.round(totalBacklinks * 0.15),
      followBacklinks: Math.round(totalBacklinks * 0.7),
      nofollowBacklinks: Math.round(totalBacklinks * 0.3),
      intentDistribution: {
        informational: 45,
        navigational: 15,
        commercial: 25,
        transactional: 15,
      },
      positionDistribution: {
        top3: Math.round(organicKeywords * 0.05),
        pos4_10: Math.round(organicKeywords * 0.1),
        pos11_20: Math.round(organicKeywords * 0.2),
        pos21_50: Math.round(organicKeywords * 0.35),
        pos51_100: Math.round(organicKeywords * 0.3),
      },
      topOrganicKeywords,
      topOrganicPages,
      topCompetitors,
      countryDistribution: [
        { country: country, trafficShare: 45 },
        { country: 'US', trafficShare: 20 },
        { country: 'GB', trafficShare: 12 },
        { country: 'CA', trafficShare: 8 },
        { country: 'IN', trafficShare: 5 },
      ],
    };
  }

  // ─── HELPERS ──────────────────────────────────────────────

  private normalizeDomain(input: string): string {
    let domain = input.trim().toLowerCase();
    // Strip protocol
    domain = domain.replace(/^https?:\/\//, '');
    // Strip www
    domain = domain.replace(/^www\./, '');
    // Strip path, query, fragment
    domain = domain.split('/')[0].split('?')[0].split('#')[0];
    // Strip trailing dot
    domain = domain.replace(/\.$/, '');
    return domain;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private mapCacheToResponse(
    cached: any,
    domain: string,
    country: string,
  ): DomainOverviewData {
    return {
      domain,
      country,
      authorityScore: cached.authorityScore,
      authorityTrend: cached.authorityTrend as number[] | null,
      organicKeywords: cached.organicKeywords,
      organicTraffic: cached.organicTraffic,
      organicTrafficCost: cached.organicTrafficCost,
      organicTrafficTrend: cached.organicTrafficTrend as any,
      paidKeywords: cached.paidKeywords,
      paidTraffic: cached.paidTraffic,
      paidTrafficCost: cached.paidTrafficCost,
      totalBacklinks: cached.totalBacklinks,
      referringDomains: cached.referringDomains,
      followBacklinks: cached.followBacklinks,
      nofollowBacklinks: cached.nofollowBacklinks,
      intentDistribution: cached.intentDistribution as any,
      positionDistribution: cached.positionDistribution as any,
      topOrganicKeywords: cached.topOrganicKeywords as any,
      topOrganicPages: cached.topOrganicPages as any,
      topCompetitors: cached.topCompetitors as any,
      countryDistribution: cached.countryDistribution as any,
    };
  }

  private async incrementUsage(userId: string): Promise<void> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const period = `${todayStart.getFullYear()}-${String(todayStart.getMonth() + 1).padStart(2, '0')}-${String(todayStart.getDate()).padStart(2, '0')}`;

    await this.prisma.usageRecord.upsert({
      where: {
        userId_metric_period: {
          userId,
          metric: 'DOMAIN_OVERVIEWS',
          period,
        },
      },
      create: {
        userId,
        metric: 'DOMAIN_OVERVIEWS',
        count: 1,
        limit: 999999,
        period,
      },
      update: {
        count: { increment: 1 },
      },
    });
  }
}
