import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

type LinkType = 'follow' | 'nofollow';

interface BacklinksOverview {
  totalBacklinks: number;
  referringDomains: number;
  referringIps: number;
  authorityScore: number;
  followBacklinks: number;
  nofollowBacklinks: number;
  dofollowPercent: number;
  textBacklinks: number;
  imageBacklinks: number;
  newBacklinks30d: number;
  lostBacklinks30d: number;
}

interface TrendPoint {
  month: string;
  backlinks: number;
  referringDomains: number;
  authorityScore: number;
}

interface ReferringDomainRow {
  domain: string;
  authorityScore: number;
  backlinks: number;
  firstSeen: string;
  countryCode: string;
  followRatio: number;
  category: string;
}

interface AnchorRow {
  anchor: string;
  count: number;
  percentage: number;
}

interface BacklinkRow {
  sourceUrl: string;
  sourceTitle: string;
  sourceAuthority: number;
  targetUrl: string;
  anchor: string;
  type: LinkType;
  firstSeen: string;
}

interface DistributionRow {
  label: string;
  count: number;
  percentage: number;
}

interface BacklinksData {
  domain: string;
  country: string;
  overview: BacklinksOverview;
  trend: TrendPoint[];
  topReferringDomains: ReferringDomainRow[];
  anchorDistribution: AnchorRow[];
  topBacklinks: BacklinkRow[];
  newBacklinks: BacklinkRow[];
  lostBacklinks: BacklinkRow[];
  tldDistribution: DistributionRow[];
  categoryDistribution: DistributionRow[];
}

@Injectable()
export class BacklinksService {
  private readonly logger = new Logger(BacklinksService.name);
  private readonly openaiKey: string;
  private readonly hasOpenAI: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;

    if (!this.hasOpenAI) {
      this.logger.warn('OpenAI not configured for backlinks analytics');
    }
  }

  async getBacklinks(
    domainInput: string,
    country: string,
    userId: string,
  ): Promise<BacklinksData> {
    const domain = this.normalizeDomain(domainInput);
    if (!domain) throw new BadRequestException('Domain is required');

    const cacheKey = `${domain}|${country}|bl-analytics`;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const cached = await (this.prisma as any).backlinksCache.findUnique({
      where: { cacheKey },
    });

    if (cached && cached.updatedAt > sevenDaysAgo) {
      return cached.data as unknown as BacklinksData;
    }

    if (!this.hasOpenAI)
      throw new BadRequestException('OpenAI API key is not configured');

    const data = await this.fetchFromOpenAI(domain, country);

    await (this.prisma as any).backlinksCache.upsert({
      where: { cacheKey },
      create: { cacheKey, data: data as any },
      update: { data: data as any },
    });

    await this.incrementUsage(userId);

    return data;
  }

  private async fetchFromOpenAI(
    domain: string,
    country: string,
  ): Promise<BacklinksData> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          temperature: 0.4,
          max_tokens: 4500,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `SEO backlink analyst. Generate a realistic backlink profile for the given domain. Estimates should reflect the domain's actual authority/niche. Return ONLY this JSON structure:
{
  "overview": {
    "totalBacklinks": <int>,
    "referringDomains": <int>,
    "referringIps": <int>,
    "authorityScore": <0-100>,
    "followBacklinks": <int>,
    "nofollowBacklinks": <int>,
    "dofollowPercent": <int 0-100>,
    "textBacklinks": <int>,
    "imageBacklinks": <int>,
    "newBacklinks30d": <int>,
    "lostBacklinks30d": <int>
  },
  "trend": [{"month":"YYYY-MM","backlinks":<int>,"referringDomains":<int>,"authorityScore":<int>}],
  "topReferringDomains": [{"domain":"<str>","authorityScore":<0-100>,"backlinks":<int>,"firstSeen":"YYYY-MM-DD","countryCode":"<2-letter>","followRatio":<0-1 float>,"category":"<str>"}],
  "anchorDistribution": [{"anchor":"<str>","count":<int>,"percentage":<float>}],
  "topBacklinks": [{"sourceUrl":"<full url>","sourceTitle":"<str>","sourceAuthority":<0-100>,"targetUrl":"<full url>","anchor":"<str>","type":"follow|nofollow","firstSeen":"YYYY-MM-DD"}],
  "newBacklinks": [{"sourceUrl":"<full url>","sourceTitle":"<str>","sourceAuthority":<0-100>,"targetUrl":"<full url>","anchor":"<str>","type":"follow|nofollow","firstSeen":"YYYY-MM-DD"}],
  "lostBacklinks": [{"sourceUrl":"<full url>","sourceTitle":"<str>","sourceAuthority":<0-100>,"targetUrl":"<full url>","anchor":"<str>","type":"follow|nofollow","firstSeen":"YYYY-MM-DD"}],
  "tldDistribution": [{"label":"<str>","count":<int>,"percentage":<float>}],
  "categoryDistribution": [{"label":"<str>","count":<int>,"percentage":<float>}]
}
Counts: trend=12 months (most recent last); topReferringDomains=15; anchorDistribution=10 (include branded, naked URL, and partial-match anchors); topBacklinks=15; newBacklinks=6; lostBacklinks=4; tldDistribution=8; categoryDistribution=6. Make followBacklinks+nofollowBacklinks=totalBacklinks. dofollowPercent=round(followBacklinks/totalBacklinks*100). Use realistic referring-domain names for the niche, plausible source URLs under those domains, varied anchor texts (brand, exact, partial, generic like "click here", naked URLs). Categories like "Technology","News","Blog","Business","Education","Forum","Directory". TLDs like ".com",".org",".net",".co",".io",".edu",".gov",".co.${country.toLowerCase()}".`,
            },
            {
              role: 'user',
              content: `Domain: "${domain}"\nCountry: ${country}\nGenerate the backlink profile.`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
        },
      );

      const content = response.data.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content);

      const overview: BacklinksOverview = parsed.overview || {
        totalBacklinks: 0,
        referringDomains: 0,
        referringIps: 0,
        authorityScore: 0,
        followBacklinks: 0,
        nofollowBacklinks: 0,
        dofollowPercent: 0,
        textBacklinks: 0,
        imageBacklinks: 0,
        newBacklinks30d: 0,
        lostBacklinks30d: 0,
      };

      return {
        domain,
        country,
        overview,
        trend: Array.isArray(parsed.trend) ? parsed.trend : [],
        topReferringDomains: Array.isArray(parsed.topReferringDomains)
          ? parsed.topReferringDomains
          : [],
        anchorDistribution: Array.isArray(parsed.anchorDistribution)
          ? parsed.anchorDistribution
          : [],
        topBacklinks: Array.isArray(parsed.topBacklinks)
          ? parsed.topBacklinks
          : [],
        newBacklinks: Array.isArray(parsed.newBacklinks)
          ? parsed.newBacklinks
          : [],
        lostBacklinks: Array.isArray(parsed.lostBacklinks)
          ? parsed.lostBacklinks
          : [],
        tldDistribution: Array.isArray(parsed.tldDistribution)
          ? parsed.tldDistribution
          : [],
        categoryDistribution: Array.isArray(parsed.categoryDistribution)
          ? parsed.categoryDistribution
          : [],
      };
    } catch (err: any) {
      const detail = err?.response?.data || err?.message || err;
      this.logger.error(`OpenAI backlinks error: ${JSON.stringify(detail)}`);
      throw new BadRequestException(
        `Backlinks analysis failed: ${err?.message || 'Unknown error'}`,
      );
    }
  }

  private normalizeDomain(input: string): string {
    let domain = (input || '').trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//, '');
    domain = domain.replace(/^www\./, '');
    domain = domain.split('/')[0].split('?')[0].split('#')[0];
    domain = domain.replace(/\.$/, '');
    return domain;
  }

  private async incrementUsage(userId: string): Promise<void> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const period = `${todayStart.getFullYear()}-${String(todayStart.getMonth() + 1).padStart(2, '0')}-${String(todayStart.getDate()).padStart(2, '0')}`;

    await this.prisma.usageRecord.upsert({
      where: {
        userId_metric_period: {
          userId,
          metric: 'BACKLINKS' as any,
          period,
        },
      },
      create: {
        userId,
        metric: 'BACKLINKS' as any,
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
