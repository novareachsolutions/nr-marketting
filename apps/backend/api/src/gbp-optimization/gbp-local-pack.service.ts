import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { isSerpApiConfigured } from '../common/utils/serpapi';

export interface LocalPackResult {
  position: number;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  phone: string | null;
  website: string | null;
  placeId: string | null;
  type: string | null;
}

export interface LocalPackRankingResponse {
  keyword: string;
  searchLocation: string;
  myBusinessPosition: number | null;
  myBusinessName: string;
  myBusinessFound: boolean;
  topResults: LocalPackResult[];
  totalResults: number;
  checkedAt: string;
}

@Injectable()
export class GbpLocalPackService {
  private readonly logger = new Logger(GbpLocalPackService.name);
  private readonly serpApiKey: string;
  private readonly hasSerpApi: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.serpApiKey = this.config.get<string>('SERPAPI_KEY') || '';
    this.hasSerpApi = isSerpApiConfigured(this.serpApiKey);

    if (this.hasSerpApi) {
      this.logger.log('GBP Local Pack: using SerpAPI google_local engine');
    } else {
      this.logger.warn('GBP Local Pack: SERPAPI_KEY not configured — endpoint will throw 503');
    }
  }

  /**
   * Check where the user's business ranks in the Google local pack for a
   * given keyword. Uses SerpAPI's google_local engine.
   *
   * Cost: 1 SerpAPI credit per call.
   */
  async checkLocalRanking(
    userId: string,
    locationId: string,
    keyword: string,
  ): Promise<LocalPackRankingResponse> {
    if (!this.hasSerpApi) {
      throw new ServiceUnavailableException(
        'Local pack ranking requires SERPAPI_KEY',
      );
    }

    const trimmed = keyword.trim();
    if (!trimmed) {
      throw new BadRequestException('Keyword is required');
    }

    const location = await this.prisma.gbpLocation.findUnique({
      where: { id: locationId },
    });
    if (!location) throw new NotFoundException('Location not found');
    if (location.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Build the "location" parameter for SerpAPI from the GBP address
    const searchLocation = this.buildSearchLocation(location);

    try {
      const response = await axios.get('https://serpapi.com/search.json', {
        params: {
          api_key: this.serpApiKey,
          engine: 'google_local',
          q: trimmed,
          location: searchLocation,
          hl: 'en',
        },
        timeout: 30000,
      });

      const data = response.data || {};
      const localResultsRaw: any[] = Array.isArray(data.local_results)
        ? data.local_results
        : [];

      const topResults: LocalPackResult[] = localResultsRaw.map((r, i) => ({
        position: typeof r.position === 'number' ? r.position : i + 1,
        name: r.title || '',
        address: r.address || '',
        rating: typeof r.rating === 'number' ? r.rating : null,
        reviewCount: typeof r.reviews === 'number' ? r.reviews : null,
        phone: r.phone || null,
        website: r.links?.website || r.website || null,
        placeId: r.place_id || null,
        type: r.type || (Array.isArray(r.types) ? r.types[0] : null),
      }));

      const myPos = this.findMyBusinessPosition(topResults, location.name);

      return {
        keyword: trimmed,
        searchLocation,
        myBusinessPosition: myPos,
        myBusinessName: location.name,
        myBusinessFound: myPos !== null,
        topResults,
        totalResults: topResults.length,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      this.logger.error(`SerpAPI google_local request failed: ${err}`);
      throw new ServiceUnavailableException(
        'Local pack lookup failed — SerpAPI request error',
      );
    }
  }

  /**
   * Build a "location" string for SerpAPI's google_local engine.
   * SerpAPI accepts free-form location strings like "Brisbane, Queensland, Australia".
   */
  private buildSearchLocation(location: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    region?: string | null;
    countryCode?: string | null;
  }): string {
    const parts = [location.city, location.region, location.countryCode].filter(
      (p): p is string => typeof p === 'string' && p.length > 0,
    );
    return parts.length > 0
      ? parts.join(', ')
      : [location.addressLine1, location.addressLine2]
          .filter((p): p is string => typeof p === 'string' && p.length > 0)
          .join(', ');
  }

  /**
   * Match the user's business name against the local pack results.
   * Uses a loose comparison since Google often renders branded names
   * with extra suffixes (e.g. "Devine Tiles - Brisbane Showroom").
   */
  private findMyBusinessPosition(
    results: LocalPackResult[],
    myBusinessName: string,
  ): number | null {
    const norm = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const target = norm(myBusinessName);
    if (!target) return null;

    for (const r of results) {
      const candidate = norm(r.name);
      if (!candidate) continue;
      if (candidate === target || candidate.includes(target) || target.includes(candidate)) {
        return r.position;
      }
    }

    return null;
  }
}
