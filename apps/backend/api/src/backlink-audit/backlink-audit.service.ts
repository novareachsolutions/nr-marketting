import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

type ToxicityLevel = 'clean' | 'suspicious' | 'toxic';
type LinkStatus = 'pending' | 'keep' | 'flag' | 'disavow';

interface AiInsight {
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  action: string;
}

interface AiDistribution {
  toxicityBuckets: { label: string; count: number }[];
  authorityBuckets: { label: string; count: number }[];
  tld: { label: string; count: number }[];
  anchor: { label: string; count: number; percentage: number }[];
  category: { label: string; count: number }[];
}

interface AiBacklinkRow {
  sourceUrl: string;
  sourceTitle: string;
  sourceDomain: string;
  targetUrl: string;
  anchor: string;
  linkType: 'follow' | 'nofollow';
  category: string;
  tld: string;
  firstSeen: string;
  sourceAuthority: number;
  toxicityScore: number;
  toxicityLevel: ToxicityLevel;
  riskFactors: string[];
}

interface AiAuditResponse {
  toxicityScore: number;
  authorityScore: number;
  totalLinks: number;
  totalDomains: number;
  toxicCount: number;
  suspiciousCount: number;
  cleanCount: number;
  insights: AiInsight[];
  distribution: AiDistribution;
  links: AiBacklinkRow[];
}

@Injectable()
export class BacklinkAuditService {
  private readonly logger = new Logger(BacklinkAuditService.name);
  private readonly openaiKey: string;
  private readonly hasOpenAI: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;

    if (!this.hasOpenAI) {
      this.logger.warn('OpenAI not configured for backlink audit');
    }
  }

  // ─── RUN AUDIT ─────────────────────────────────────────

  async runAudit(userId: string, domainInput: string, country = 'US') {
    const domain = this.normalizeDomain(domainInput);
    if (!domain) throw new BadRequestException('Domain is required');
    if (!this.hasOpenAI)
      throw new BadRequestException('OpenAI API key is not configured');

    const ai = await this.fetchFromOpenAI(domain, country);

    const job = await this.prisma.backlinkAuditJob.create({
      data: {
        userId,
        domain,
        country,
        toxicityScore: ai.toxicityScore,
        authorityScore: ai.authorityScore,
        totalLinks: ai.totalLinks,
        totalDomains: ai.totalDomains,
        toxicCount: ai.toxicCount,
        suspiciousCount: ai.suspiciousCount,
        cleanCount: ai.cleanCount,
        insights: ai.insights as any,
        distribution: ai.distribution as any,
        links: {
          create: ai.links.map((l) => ({
            sourceUrl: l.sourceUrl,
            sourceTitle: l.sourceTitle,
            sourceDomain: l.sourceDomain,
            targetUrl: l.targetUrl,
            anchor: l.anchor,
            linkType: l.linkType,
            category: l.category,
            tld: l.tld,
            firstSeen: l.firstSeen,
            sourceAuthority: l.sourceAuthority,
            toxicityScore: l.toxicityScore,
            toxicityLevel: l.toxicityLevel,
            riskFactors: l.riskFactors as any,
          })),
        },
      },
      include: { links: true },
    });

    await this.incrementUsage(userId);
    return job;
  }

  // ─── LIST AUDITS FOR USER ──────────────────────────────

  async listAudits(userId: string) {
    return this.prisma.backlinkAuditJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        domain: true,
        country: true,
        toxicityScore: true,
        totalLinks: true,
        toxicCount: true,
        suspiciousCount: true,
        cleanCount: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 50,
    });
  }

  // ─── GET LATEST AUDIT FOR DOMAIN ───────────────────────

  async getLatestByDomain(userId: string, domainInput: string, country = 'US') {
    const domain = this.normalizeDomain(domainInput);
    if (!domain) throw new BadRequestException('Domain is required');

    const job = await this.prisma.backlinkAuditJob.findFirst({
      where: { userId, domain, country },
      orderBy: { createdAt: 'desc' },
      include: { links: { orderBy: { toxicityScore: 'desc' } } },
    });
    return job;
  }

  // ─── GET BY ID ─────────────────────────────────────────

  async getById(userId: string, id: string) {
    const job = await this.prisma.backlinkAuditJob.findUnique({
      where: { id },
      include: { links: { orderBy: { toxicityScore: 'desc' } } },
    });
    if (!job) throw new NotFoundException('Audit not found');
    if (job.userId !== userId) throw new ForbiddenException('Access denied');
    return job;
  }

  // ─── UPDATE LINK STATUS ────────────────────────────────

  async updateLinkStatus(
    userId: string,
    jobId: string,
    linkId: string,
    status: LinkStatus,
    userNote?: string,
  ) {
    const validStatuses: LinkStatus[] = ['pending', 'keep', 'flag', 'disavow'];
    if (!validStatuses.includes(status))
      throw new BadRequestException('Invalid status');

    const job = await this.prisma.backlinkAuditJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException('Audit not found');
    if (job.userId !== userId) throw new ForbiddenException('Access denied');

    const link = await this.prisma.backlinkAuditLink.findUnique({
      where: { id: linkId },
    });
    if (!link || link.jobId !== jobId)
      throw new NotFoundException('Link not found in this audit');

    return this.prisma.backlinkAuditLink.update({
      where: { id: linkId },
      data: {
        status,
        userNote: userNote ?? link.userNote,
      },
    });
  }

  // ─── BULK UPDATE ───────────────────────────────────────

  async bulkUpdateStatus(
    userId: string,
    jobId: string,
    linkIds: string[],
    status: LinkStatus,
  ) {
    const job = await this.prisma.backlinkAuditJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException('Audit not found');
    if (job.userId !== userId) throw new ForbiddenException('Access denied');

    const validStatuses: LinkStatus[] = ['pending', 'keep', 'flag', 'disavow'];
    if (!validStatuses.includes(status))
      throw new BadRequestException('Invalid status');

    const result = await this.prisma.backlinkAuditLink.updateMany({
      where: { jobId, id: { in: linkIds } },
      data: { status },
    });
    return { updated: result.count };
  }

  // ─── DELETE AUDIT ──────────────────────────────────────

  async deleteAudit(userId: string, id: string) {
    const job = await this.prisma.backlinkAuditJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Audit not found');
    if (job.userId !== userId) throw new ForbiddenException('Access denied');

    await this.prisma.backlinkAuditJob.delete({ where: { id } });
    return { deleted: true };
  }

  // ─── EXPORT DISAVOW FILE ───────────────────────────────

  async buildDisavowFile(userId: string, jobId: string): Promise<string> {
    const job = await this.prisma.backlinkAuditJob.findUnique({
      where: { id: jobId },
      include: {
        links: {
          where: { status: 'disavow' },
          select: { sourceDomain: true, sourceUrl: true },
        },
      },
    });
    if (!job) throw new NotFoundException('Audit not found');
    if (job.userId !== userId) throw new ForbiddenException('Access denied');

    const uniqueDomains = Array.from(
      new Set(job.links.map((l) => l.sourceDomain.trim()).filter(Boolean)),
    ).sort();

    const lines: string[] = [
      `# Disavow file generated by NR SEO — Backlink Audit`,
      `# Domain audited: ${job.domain}`,
      `# Country: ${job.country}`,
      `# Generated: ${new Date().toISOString()}`,
      `# Entries: ${uniqueDomains.length}`,
      `#`,
      `# Upload this file to Google Search Console > Disavow Links Tool`,
      `# https://search.google.com/search-console/disavow-links`,
      `#`,
    ];
    for (const d of uniqueDomains) {
      lines.push(`domain:${d}`);
    }
    return lines.join('\n') + '\n';
  }

  // ─── OPENAI CALL ───────────────────────────────────────

  private async fetchFromOpenAI(
    domain: string,
    country: string,
  ): Promise<AiAuditResponse> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          temperature: 0.4,
          max_tokens: 6000,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `SEO backlink audit analyst. Evaluate a realistic backlink profile for the given domain and identify toxic, suspicious, and clean links. Return ONLY this JSON structure:
{
  "toxicityScore": <int 0-100 — percentage of profile that is suspicious+toxic>,
  "authorityScore": <int 0-100 — weighted avg authority of source domains>,
  "totalLinks": <int>,
  "totalDomains": <int>,
  "toxicCount": <int>,
  "suspiciousCount": <int>,
  "cleanCount": <int>,
  "insights": [
    {"severity":"low|medium|high","title":"<short>","description":"<1-2 sentences>","action":"<what to do>"}
  ],
  "distribution": {
    "toxicityBuckets": [{"label":"Clean (0-30)","count":<int>},{"label":"Suspicious (31-60)","count":<int>},{"label":"Toxic (61-100)","count":<int>}],
    "authorityBuckets": [{"label":"0-20","count":<int>},{"label":"21-40","count":<int>},{"label":"41-60","count":<int>},{"label":"61-80","count":<int>},{"label":"81-100","count":<int>}],
    "tld": [{"label":".com","count":<int>}],
    "anchor": [{"label":"<str>","count":<int>,"percentage":<float>}],
    "category": [{"label":"<str>","count":<int>}]
  },
  "links": [
    {
      "sourceUrl":"<full url>",
      "sourceTitle":"<page title>",
      "sourceDomain":"<domain only>",
      "targetUrl":"<full url on audited domain>",
      "anchor":"<anchor text>",
      "linkType":"follow|nofollow",
      "category":"<str>",
      "tld":"<.com etc>",
      "firstSeen":"YYYY-MM-DD",
      "sourceAuthority":<0-100>,
      "toxicityScore":<0-100>,
      "toxicityLevel":"clean|suspicious|toxic",
      "riskFactors":["<factor>"]
    }
  ]
}

Rules:
- Generate exactly 30 link rows. Mix: ~15 clean, ~10 suspicious, ~5 toxic. Realistic — depends on the domain's profile.
- toxicityLevel: clean=score 0-30, suspicious=31-60, toxic=61-100.
- totalLinks = 30. totalDomains = unique sourceDomain count.
- toxicCount/suspiciousCount/cleanCount must match the rows.
- toxicityScore (top level) = round((suspiciousCount + toxicCount) / totalLinks * 100).
- Risk factors — pick 0-5 applicable items per row from: "Low authority source" | "Spammy TLD" | "Link farm pattern" | "Excessive outbound links" | "Unrelated niche" | "Thin content source" | "Hacked / deindexed site" | "Paid link pattern" | "Exact-match over-optimization" | "Private blog network (PBN)" | "Comment / forum spam" | "Sitewide footer link" | "Low domain age" | "Foreign language mismatch" | "Adult / gambling niche" | "Scraper site" | "Parked domain". Clean links should have 0-1 factors (or none); toxic links 3-5.
- insights: 4-6 actionable recommendations prioritized by severity.
- Anchor distribution: top 8 anchors with percentages summing roughly to 100.
- TLDs: 6-8 common ones. Categories: 5-6. Authority buckets: all 5 buckets filled (some may be 0).
- Use realistic source URLs under plausible referring domains for the niche.
- targetUrl should be under the audited domain.`,
            },
            {
              role: 'user',
              content: `Domain: "${domain}"\nCountry: ${country}\nRun the backlink audit.`,
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

      // Defensive defaults
      const links: AiBacklinkRow[] = Array.isArray(parsed.links)
        ? parsed.links
        : [];

      return {
        toxicityScore: Number(parsed.toxicityScore) || 0,
        authorityScore: Number(parsed.authorityScore) || 0,
        totalLinks: Number(parsed.totalLinks) || links.length,
        totalDomains:
          Number(parsed.totalDomains) ||
          new Set(links.map((l) => l.sourceDomain)).size,
        toxicCount: Number(parsed.toxicCount) || 0,
        suspiciousCount: Number(parsed.suspiciousCount) || 0,
        cleanCount: Number(parsed.cleanCount) || 0,
        insights: Array.isArray(parsed.insights) ? parsed.insights : [],
        distribution: parsed.distribution || {
          toxicityBuckets: [],
          authorityBuckets: [],
          tld: [],
          anchor: [],
          category: [],
        },
        links,
      };
    } catch (err: any) {
      const detail = err?.response?.data || err?.message || err;
      this.logger.error(`OpenAI backlink-audit error: ${JSON.stringify(detail)}`);
      throw new BadRequestException(
        `Backlink audit failed: ${err?.message || 'Unknown error'}`,
      );
    }
  }

  // ─── HELPERS ───────────────────────────────────────────

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
          metric: 'BACKLINK_AUDIT',
          period,
        },
      },
      create: {
        userId,
        metric: 'BACKLINK_AUDIT',
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
