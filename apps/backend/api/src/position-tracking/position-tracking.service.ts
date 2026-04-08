import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// CTR model by position (industry standard estimates)
const CTR_MODEL: Record<number, number> = {
  1: 0.317,
  2: 0.247,
  3: 0.186,
  4: 0.133,
  5: 0.095,
  6: 0.062,
  7: 0.045,
  8: 0.034,
  9: 0.026,
  10: 0.024,
};

function getCtrForPosition(position: number | null): number {
  if (position === null || position > 100) return 0;
  if (position <= 10) return CTR_MODEL[Math.ceil(position)] || 0.024;
  if (position <= 20) return 0.01;
  if (position <= 50) return 0.005;
  return 0.001;
}

@Injectable()
export class PositionTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── KEYWORD MANAGEMENT ─────────────────────────────────

  async addKeywords(
    projectId: string,
    keywords: string[],
    _plan: string,
    device: 'DESKTOP' | 'MOBILE' = 'DESKTOP',
    country: string = 'US',
    targetUrl?: string,
  ) {
    const results = [];
    for (const keyword of keywords) {
      const trimmed = keyword.trim().toLowerCase();
      if (!trimmed) continue;

      // Look up cached search volume
      const cached = await this.prisma.keywordCache.findUnique({
        where: { keyword_country: { keyword: trimmed, country } },
      });

      const tracked = await this.prisma.trackedKeyword.upsert({
        where: {
          projectId_keyword_device_country: {
            projectId,
            keyword: trimmed,
            device,
            country,
          },
        },
        update: { isActive: true, targetUrl, searchVolume: cached?.searchVolume },
        create: {
          projectId,
          keyword: trimmed,
          device,
          country,
          targetUrl,
          searchVolume: cached?.searchVolume,
        },
      });
      results.push(tracked);
    }

    return { added: results.length, keywords: results };
  }

  async importFromProject(
    projectId: string,
    plan: string,
    keywordIds?: string[],
    all?: boolean,
    device: 'DESKTOP' | 'MOBILE' = 'DESKTOP',
    country: string = 'US',
  ) {
    let projectKeywords;
    if (all) {
      projectKeywords = await this.prisma.projectKeyword.findMany({
        where: { projectId },
      });
    } else if (keywordIds?.length) {
      projectKeywords = await this.prisma.projectKeyword.findMany({
        where: { projectId, id: { in: keywordIds } },
      });
    } else {
      throw new BadRequestException('Provide keywordIds or set all: true');
    }

    const keywords = projectKeywords.map((pk) => pk.keyword);
    return this.addKeywords(projectId, keywords, plan, device, country);
  }

  async getTrackedKeywords(
    projectId: string,
    page: number = 1,
    perPage: number = 50,
    filters?: {
      tagId?: string;
      positionMin?: number;
      positionMax?: number;
      changeType?: string;
      device?: string;
      search?: string;
      sort?: string;
      order?: string;
    },
  ) {
    const where: any = { projectId, isActive: true };

    if (filters?.device) where.device = filters.device;
    if (filters?.search) {
      where.keyword = { contains: filters.search, mode: 'insensitive' };
    }
    if (filters?.tagId) {
      where.tags = { some: { tagId: filters.tagId } };
    }

    const total = await this.prisma.trackedKeyword.count({ where });

    const trackedKeywords = await this.prisma.trackedKeyword.findMany({
      where,
      include: {
        tags: { include: { tag: true } },
        rankingHistory: {
          orderBy: { date: 'desc' },
          take: 2, // latest + previous for change calculation
        },
      },
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: filters?.sort
        ? { [filters.sort === 'keyword' ? 'keyword' : filters.sort === 'searchVolume' ? 'searchVolume' : 'createdAt']: filters?.order === 'asc' ? 'asc' : 'desc' }
        : { createdAt: 'desc' },
    });

    const keywords = trackedKeywords.map((tk) => {
      const latest = tk.rankingHistory[0] || null;
      const previous = tk.rankingHistory[1] || null;

      const currentPosition = latest?.position ?? null;
      const previousPosition = previous?.position ?? null;

      let change: number | null = null;
      let changeType: string = 'unchanged';

      if (currentPosition !== null && previousPosition !== null) {
        change = previousPosition - currentPosition; // positive = improved
        changeType = change > 0 ? 'improved' : change < 0 ? 'declined' : 'unchanged';
      } else if (currentPosition !== null && previousPosition === null) {
        changeType = 'new';
      } else if (currentPosition === null && previousPosition !== null) {
        changeType = 'lost';
      }

      return {
        id: tk.id,
        keyword: tk.keyword,
        targetUrl: tk.targetUrl,
        device: tk.device,
        country: tk.country,
        searchVolume: tk.searchVolume,
        isActive: tk.isActive,
        createdAt: tk.createdAt,
        currentPosition,
        previousPosition,
        change,
        changeType,
        rankingUrl: latest?.rankingUrl ?? null,
        serpFeatures: latest?.serpFeatures ?? null,
        tags: tk.tags.map((t) => ({
          id: t.tag.id,
          name: t.tag.name,
          color: t.tag.color,
        })),
      };
    });

    // Apply post-query filters (position-based, changeType)
    let filtered = keywords;
    if (filters?.positionMin !== undefined) {
      filtered = filtered.filter(
        (k) => k.currentPosition !== null && k.currentPosition >= filters.positionMin!,
      );
    }
    if (filters?.positionMax !== undefined) {
      filtered = filtered.filter(
        (k) => k.currentPosition !== null && k.currentPosition <= filters.positionMax!,
      );
    }
    if (filters?.changeType) {
      filtered = filtered.filter((k) => k.changeType === filters.changeType);
    }

    // Sort by position or change if requested
    if (filters?.sort === 'position') {
      filtered.sort((a, b) => {
        const posA = a.currentPosition ?? 999;
        const posB = b.currentPosition ?? 999;
        return filters.order === 'asc' ? posA - posB : posB - posA;
      });
    } else if (filters?.sort === 'change') {
      filtered.sort((a, b) => {
        const chA = a.change ?? 0;
        const chB = b.change ?? 0;
        return filters.order === 'asc' ? chA - chB : chB - chA;
      });
    }

    return {
      keywords: filtered,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    };
  }

  async updateKeyword(projectId: string, keywordId: string, targetUrl?: string) {
    const keyword = await this.prisma.trackedKeyword.findFirst({
      where: { id: keywordId, projectId },
    });
    if (!keyword) throw new NotFoundException('Tracked keyword not found');

    return this.prisma.trackedKeyword.update({
      where: { id: keywordId },
      data: { targetUrl },
    });
  }

  async deleteKeyword(projectId: string, keywordId: string) {
    const keyword = await this.prisma.trackedKeyword.findFirst({
      where: { id: keywordId, projectId },
    });
    if (!keyword) throw new NotFoundException('Tracked keyword not found');

    await this.prisma.trackedKeyword.delete({ where: { id: keywordId } });
    return { message: 'Keyword removed from tracking' };
  }

  async bulkDelete(projectId: string, keywordIds: string[]) {
    const result = await this.prisma.trackedKeyword.deleteMany({
      where: { id: { in: keywordIds }, projectId },
    });
    return { deleted: result.count };
  }

  // ─── TAG MANAGEMENT ─────────────────────────────────────

  async getTags(projectId: string) {
    const tags = await this.prisma.keywordTag.findMany({
      where: { projectId },
      include: { _count: { select: { trackedKeywords: true } } },
      orderBy: { name: 'asc' },
    });

    return tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      keywordCount: t._count.trackedKeywords,
    }));
  }

  async createTag(projectId: string, name: string, color?: string) {
    return this.prisma.keywordTag.create({
      data: { projectId, name: name.trim(), color: color || '#6366f1' },
    });
  }

  async deleteTag(projectId: string, tagId: string) {
    const tag = await this.prisma.keywordTag.findFirst({
      where: { id: tagId, projectId },
    });
    if (!tag) throw new NotFoundException('Tag not found');

    await this.prisma.keywordTag.delete({ where: { id: tagId } });
    return { message: 'Tag deleted' };
  }

  async bulkTag(projectId: string, keywordIds: string[], tagId: string) {
    // Verify tag belongs to project
    const tag = await this.prisma.keywordTag.findFirst({
      where: { id: tagId, projectId },
    });
    if (!tag) throw new NotFoundException('Tag not found');

    const data = keywordIds.map((kwId) => ({
      trackedKeywordId: kwId,
      tagId,
    }));

    // Use skipDuplicates to handle already-tagged keywords
    await this.prisma.trackedKeywordTag.createMany({
      data,
      skipDuplicates: true,
    });

    return { tagged: keywordIds.length };
  }

  async bulkUntag(_projectId: string, keywordIds: string[], tagId: string) {
    await this.prisma.trackedKeywordTag.deleteMany({
      where: {
        tagId,
        trackedKeywordId: { in: keywordIds },
      },
    });
    return { untagged: keywordIds.length };
  }

  // ─── OVERVIEW ANALYTICS ─────────────────────────────────

  async getOverview(projectId: string, device?: string) {
    const where: any = { projectId, isActive: true };
    if (device) where.device = device;

    const trackedKeywords = await this.prisma.trackedKeyword.findMany({
      where,
      include: {
        rankingHistory: {
          orderBy: { date: 'desc' },
          take: 2,
        },
      },
    });

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { lastRankCheckAt: true, rankCheckSchedule: true },
    });

    let visibilityScore = 0;
    let estimatedTraffic = 0;
    let totalPositions = 0;
    let positionSum = 0;
    let prevVisibility = 0;
    let prevTraffic = 0;
    let prevPositionSum = 0;
    let prevPositionCount = 0;

    const distribution = { top3: 0, top10: 0, top20: 0, top50: 0, top100: 0, notRanking: 0 };
    const changes = { improved: 0, declined: 0, new: 0, lost: 0 };

    const totalSearchVolume = trackedKeywords.reduce(
      (sum, tk) => sum + (tk.searchVolume || 0),
      0,
    );

    for (const tk of trackedKeywords) {
      const latest = tk.rankingHistory[0] || null;
      const previous = tk.rankingHistory[1] || null;
      const pos = latest?.position ?? null;
      const prevPos = previous?.position ?? null;
      const sv = tk.searchVolume || 0;

      // Current metrics
      if (pos !== null) {
        const ctr = getCtrForPosition(pos);
        if (totalSearchVolume > 0) {
          visibilityScore += ctr * sv;
        }
        estimatedTraffic += ctr * sv;
        positionSum += pos;
        totalPositions++;

        // Distribution
        if (pos <= 3) distribution.top3++;
        else if (pos <= 10) distribution.top10++;
        else if (pos <= 20) distribution.top20++;
        else if (pos <= 50) distribution.top50++;
        else distribution.top100++;
      } else {
        distribution.notRanking++;
      }

      // Previous metrics (for trend arrows)
      if (prevPos !== null) {
        const prevCtr = getCtrForPosition(prevPos);
        if (totalSearchVolume > 0) {
          prevVisibility += prevCtr * sv;
        }
        prevTraffic += prevCtr * sv;
        prevPositionSum += prevPos;
        prevPositionCount++;
      }

      // Changes
      if (pos !== null && prevPos !== null) {
        if (pos < prevPos) changes.improved++;
        else if (pos > prevPos) changes.declined++;
      } else if (pos !== null && prevPos === null) {
        changes.new++;
      } else if (pos === null && prevPos !== null) {
        changes.lost++;
      }
    }

    // Normalize visibility to 0-100
    const normalizedVisibility =
      totalSearchVolume > 0
        ? Math.round((visibilityScore / totalSearchVolume) * 100 * 100) / 100
        : 0;
    const normalizedPrevVisibility =
      totalSearchVolume > 0
        ? Math.round((prevVisibility / totalSearchVolume) * 100 * 100) / 100
        : null;

    return {
      visibilityScore: normalizedVisibility,
      previousVisibilityScore: normalizedPrevVisibility,
      estimatedTraffic: Math.round(estimatedTraffic),
      previousEstimatedTraffic: prevTraffic > 0 ? Math.round(prevTraffic) : null,
      averagePosition:
        totalPositions > 0
          ? Math.round((positionSum / totalPositions) * 10) / 10
          : null,
      previousAveragePosition:
        prevPositionCount > 0
          ? Math.round((prevPositionSum / prevPositionCount) * 10) / 10
          : null,
      totalKeywords: trackedKeywords.length,
      distribution,
      changes,
      lastCheckedAt: project?.lastRankCheckAt?.toISOString() ?? null,
      rankCheckSchedule: project?.rankCheckSchedule ?? 'NONE',
    };
  }

  async getOverviewTrend(projectId: string, days: number = 30, device?: string) {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const where: any = { projectId, isActive: true };
    if (device) where.device = device;

    const trackedKeywords = await this.prisma.trackedKeyword.findMany({
      where,
      include: {
        rankingHistory: {
          where: { date: { gte: dateFrom } },
          orderBy: { date: 'asc' },
        },
      },
    });

    // Group all history entries by date
    const dateMap = new Map<
      string,
      { positions: number[]; traffic: number; weightedVisibility: number; totalSv: number }
    >();

    for (const tk of trackedKeywords) {
      const sv = tk.searchVolume || 0;
      for (const rh of tk.rankingHistory) {
        const dateKey = rh.date.toISOString().split('T')[0];
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, { positions: [], traffic: 0, weightedVisibility: 0, totalSv: 0 });
        }
        const entry = dateMap.get(dateKey)!;
        if (rh.position !== null) {
          entry.positions.push(rh.position);
          const ctr = getCtrForPosition(rh.position);
          entry.traffic += ctr * sv;
          entry.weightedVisibility += ctr * sv;
        }
        entry.totalSv += sv;
      }
    }

    const trend = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        visibilityScore:
          data.totalSv > 0
            ? Math.round((data.weightedVisibility / data.totalSv) * 100 * 100) / 100
            : 0,
        estimatedTraffic: Math.round(data.traffic),
        averagePosition:
          data.positions.length > 0
            ? Math.round(
                (data.positions.reduce((s, p) => s + p, 0) / data.positions.length) * 10,
              ) / 10
            : null,
      }));

    return trend;
  }

  async getKeywordHistory(projectId: string, keywordId: string, days: number = 30) {
    const keyword = await this.prisma.trackedKeyword.findFirst({
      where: { id: keywordId, projectId },
    });
    if (!keyword) throw new NotFoundException('Tracked keyword not found');

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const history = await this.prisma.rankingHistory.findMany({
      where: {
        trackedKeywordId: keywordId,
        date: { gte: dateFrom },
      },
      orderBy: { date: 'desc' },
    });

    return {
      keyword: keyword.keyword,
      targetUrl: keyword.targetUrl,
      device: keyword.device,
      country: keyword.country,
      searchVolume: keyword.searchVolume,
      history: history.map((h) => ({
        id: h.id,
        position: h.position,
        clicks: h.clicks,
        impressions: h.impressions,
        ctr: h.ctr,
        rankingUrl: h.rankingUrl,
        serpFeatures: h.serpFeatures,
        date: h.date.toISOString(),
        source: h.source,
      })),
    };
  }

  // ─── SCHEDULE MANAGEMENT ────────────────────────────────

  async updateSchedule(projectId: string, schedule: string) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { rankCheckSchedule: schedule as any },
      select: { id: true, rankCheckSchedule: true },
    });
  }
}
