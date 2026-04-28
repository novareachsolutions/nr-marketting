import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { GoogleOAuthService } from '../google-oauth/google-oauth.service';

export interface GbpRemoteLocation {
  googleLocationId: string;
  googleAccountId?: string;
  name: string;
  storeCode?: string;
  phone?: string;
  websiteUrl?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  primaryCategory?: string;
  additionalCategories?: string[];
  description?: string;
  hours?: Record<string, Array<{ open: string; close: string }>>;
  attributes?: Record<string, any>;
  photos?: Array<{ url: string; type: string }>;
  verificationState?: string;
}

export interface GbpRemoteReview {
  googleReviewId: string;
  reviewerName?: string;
  reviewerPhoto?: string;
  rating: number;
  comment?: string;
  language?: string;
  replyText?: string;
  repliedAt?: Date | null;
  createdAt: Date;
}

export interface GbpRemoteMetricPoint {
  metric: string;
  value: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Wraps the Google Business Profile API.
 *
 * The GBP API requires a manual quota approval from Google which can take
 * 1–4 weeks. Until GBP_API_MODE=live is set in env, this service returns
 * deterministic mock data so the rest of the module can ship.
 */
@Injectable()
export class GbpApiService {
  private readonly logger = new Logger(GbpApiService.name);
  private readonly mode: 'mock' | 'live';

  constructor(
    private readonly oauth: GoogleOAuthService,
    private readonly config: ConfigService,
  ) {
    this.mode =
      (this.config.get<string>('GBP_API_MODE') || 'mock') === 'live'
        ? 'live'
        : 'mock';
  }

  // ─── LOCATIONS ─────────────────────────────────────────

  async listLocations(userId: string): Promise<GbpRemoteLocation[]> {
    if (this.mode === 'mock') return this.mockLocations();

    const token = await this.oauth.refreshAccessToken(userId);
    try {
      const { data: accounts } = await axios.get(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const out: GbpRemoteLocation[] = [];
      for (const account of accounts.accounts || []) {
        const { data: locs } = await axios.get(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              readMask:
                'name,title,storefrontAddress,phoneNumbers,websiteUri,categories,profile,regularHours,latlng,metadata',
            },
          },
        );
        for (const l of locs.locations || []) {
          out.push(this.mapRemoteLocation(l, account.name));
        }
      }
      return out;
    } catch (err: any) {
      this.logger.error(
        'GBP listLocations failed',
        err?.response?.data || err.message,
      );
      throw new InternalServerErrorException(
        'Failed to fetch GBP locations from Google',
      );
    }
  }

  async updateLocation(
    userId: string,
    googleLocationId: string,
    patch: Record<string, any>,
  ): Promise<void> {
    if (this.mode === 'mock') {
      this.logger.log(
        `[mock] updateLocation ${googleLocationId}: ${Object.keys(patch).join(',')}`,
      );
      return;
    }

    const token = await this.oauth.refreshAccessToken(userId);
    const updateMask = Object.keys(patch).join(',');
    try {
      await axios.patch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${googleLocationId}`,
        patch,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { updateMask },
        },
      );
    } catch (err: any) {
      this.logger.error(
        'GBP updateLocation failed',
        err?.response?.data || err.message,
      );
      throw new InternalServerErrorException('Failed to update GBP location');
    }
  }

  // ─── REVIEWS ───────────────────────────────────────────

  async listReviews(
    userId: string,
    googleLocationId: string,
  ): Promise<GbpRemoteReview[]> {
    if (this.mode === 'mock') return this.mockReviews(googleLocationId);

    const token = await this.oauth.refreshAccessToken(userId);
    try {
      const { data } = await axios.get(
        `https://mybusiness.googleapis.com/v4/${googleLocationId}/reviews`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return (data.reviews || []).map((r: any) => ({
        googleReviewId: r.reviewId,
        reviewerName: r.reviewer?.displayName,
        reviewerPhoto: r.reviewer?.profilePhotoUrl,
        rating: this.starRatingToInt(r.starRating),
        comment: r.comment,
        replyText: r.reviewReply?.comment,
        repliedAt: r.reviewReply?.updateTime
          ? new Date(r.reviewReply.updateTime)
          : null,
        createdAt: new Date(r.createTime),
      }));
    } catch (err: any) {
      this.logger.error(
        'GBP listReviews failed',
        err?.response?.data || err.message,
      );
      throw new InternalServerErrorException('Failed to fetch GBP reviews');
    }
  }

  async replyToReview(
    userId: string,
    googleReviewResourceName: string,
    reply: string,
  ): Promise<void> {
    if (this.mode === 'mock') {
      this.logger.log(`[mock] replyToReview ${googleReviewResourceName}`);
      return;
    }
    const token = await this.oauth.refreshAccessToken(userId);
    try {
      await axios.put(
        `https://mybusiness.googleapis.com/v4/${googleReviewResourceName}/reply`,
        { comment: reply },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (err: any) {
      this.logger.error(
        'GBP replyToReview failed',
        err?.response?.data || err.message,
      );
      throw new InternalServerErrorException('Failed to reply to review');
    }
  }

  // ─── POSTS ─────────────────────────────────────────────

  async publishPost(
    userId: string,
    googleLocationId: string,
    post: {
      type: string;
      content: string;
      mediaUrl?: string;
      ctaType?: string;
      ctaUrl?: string;
    },
  ): Promise<string> {
    if (this.mode === 'mock') {
      const fakeId = `posts/${Date.now()}`;
      this.logger.log(`[mock] publishPost ${googleLocationId} -> ${fakeId}`);
      return fakeId;
    }
    const token = await this.oauth.refreshAccessToken(userId);
    try {
      const body: any = {
        languageCode: 'en',
        summary: post.content,
        topicType: post.type,
      };
      if (post.mediaUrl) {
        body.media = [{ mediaFormat: 'PHOTO', sourceUrl: post.mediaUrl }];
      }
      if (post.ctaType && post.ctaUrl) {
        body.callToAction = { actionType: post.ctaType, url: post.ctaUrl };
      }
      const { data } = await axios.post(
        `https://mybusiness.googleapis.com/v4/${googleLocationId}/localPosts`,
        body,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data.name;
    } catch (err: any) {
      this.logger.error(
        'GBP publishPost failed',
        err?.response?.data || err.message,
      );
      throw new InternalServerErrorException('Failed to publish GBP post');
    }
  }

  // ─── INSIGHTS ──────────────────────────────────────────

  async fetchInsights(
    userId: string,
    googleLocationId: string,
    months: number,
  ): Promise<GbpRemoteMetricPoint[]> {
    if (this.mode === 'mock') return this.mockInsights(months);

    const token = await this.oauth.refreshAccessToken(userId);
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    const dailyMetrics = [
      'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
      'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
      'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
      'WEBSITE_CLICKS',
      'CALL_CLICKS',
      'BUSINESS_DIRECTION_REQUESTS',
      'BUSINESS_BOOKINGS',
    ];

    try {
      const url = `https://businessprofileperformance.googleapis.com/v1/${googleLocationId}:fetchMultiDailyMetricsTimeSeries`;
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          dailyMetrics,
          'dailyRange.startDate.year': start.getFullYear(),
          'dailyRange.startDate.month': start.getMonth() + 1,
          'dailyRange.startDate.day': start.getDate(),
          'dailyRange.endDate.year': end.getFullYear(),
          'dailyRange.endDate.month': end.getMonth() + 1,
          'dailyRange.endDate.day': end.getDate(),
        },
      });
      return this.normalizeInsightsPayload(data, start, end);
    } catch (err: any) {
      this.logger.error(
        'GBP fetchInsights failed',
        err?.response?.data || err.message,
      );
      throw new InternalServerErrorException('Failed to fetch GBP insights');
    }
  }

  // ─── MAPPERS ───────────────────────────────────────────

  private mapRemoteLocation(l: any, accountName: string): GbpRemoteLocation {
    const addr = l.storefrontAddress || {};
    return {
      googleLocationId: l.name,
      googleAccountId: accountName,
      name: l.title,
      storeCode: l.storeCode,
      phone: l.phoneNumbers?.primaryPhone,
      websiteUrl: l.websiteUri,
      addressLine1: (addr.addressLines || [])[0],
      addressLine2: (addr.addressLines || [])[1],
      city: addr.locality,
      region: addr.administrativeArea,
      postalCode: addr.postalCode,
      countryCode: addr.regionCode,
      latitude: l.latlng?.latitude,
      longitude: l.latlng?.longitude,
      primaryCategory: l.categories?.primaryCategory?.displayName,
      additionalCategories: (l.categories?.additionalCategories || []).map(
        (c: any) => c.displayName,
      ),
      description: l.profile?.description,
      hours: this.parseHours(l.regularHours),
      verificationState: l.metadata?.placeId ? 'VERIFIED' : 'UNVERIFIED',
    };
  }

  private parseHours(
    regularHours: any,
  ): Record<string, Array<{ open: string; close: string }>> | undefined {
    if (!regularHours?.periods) return undefined;
    const out: Record<string, Array<{ open: string; close: string }>> = {};
    for (const p of regularHours.periods) {
      const day = (p.openDay || '').toLowerCase();
      if (!day) continue;
      const open = `${p.openTime?.hours ?? 0}:${String(p.openTime?.minutes ?? 0).padStart(2, '0')}`;
      const close = `${p.closeTime?.hours ?? 0}:${String(p.closeTime?.minutes ?? 0).padStart(2, '0')}`;
      if (!out[day]) out[day] = [];
      out[day].push({ open, close });
    }
    return out;
  }

  private starRatingToInt(star: string): number {
    const map: Record<string, number> = {
      ONE: 1,
      TWO: 2,
      THREE: 3,
      FOUR: 4,
      FIVE: 5,
    };
    return map[star] || 0;
  }

  private normalizeInsightsPayload(
    data: any,
    start: Date,
    end: Date,
  ): GbpRemoteMetricPoint[] {
    const out: GbpRemoteMetricPoint[] = [];
    for (const series of data.multiDailyMetricTimeSeries || []) {
      for (const m of series.dailyMetricTimeSeries || []) {
        const metric = m.dailyMetric;
        const total = (m.timeSeries?.datedValues || []).reduce(
          (sum: number, v: any) => sum + Number(v.value || 0),
          0,
        );
        out.push({
          metric,
          value: total,
          periodStart: start,
          periodEnd: end,
        });
      }
    }
    return out;
  }

  // ─── MOCK DATA ─────────────────────────────────────────

  private mockLocations(): GbpRemoteLocation[] {
    return [
      {
        googleLocationId: 'locations/mock-001',
        googleAccountId: 'accounts/mock-001',
        name: 'Novareach Solutions — Sydney CBD',
        storeCode: 'SYD01',
        phone: '+61 2 9000 0000',
        websiteUrl: 'https://novareachsolutions.com',
        addressLine1: '12 George Street',
        city: 'Sydney',
        region: 'NSW',
        postalCode: '2000',
        countryCode: 'AU',
        latitude: -33.8688,
        longitude: 151.2093,
        primaryCategory: 'Marketing agency',
        additionalCategories: ['SEO agency', 'Software company'],
        description:
          'Novareach Solutions is a Sydney-based marketing & SEO agency helping local businesses grow through data-driven strategies, custom software, and content that ranks.',
        hours: {
          monday: [{ open: '9:00', close: '17:30' }],
          tuesday: [{ open: '9:00', close: '17:30' }],
          wednesday: [{ open: '9:00', close: '17:30' }],
          thursday: [{ open: '9:00', close: '17:30' }],
          friday: [{ open: '9:00', close: '17:00' }],
        },
        photos: [
          { url: 'https://picsum.photos/seed/gbp1/800/600', type: 'EXTERIOR' },
          { url: 'https://picsum.photos/seed/gbp2/800/600', type: 'INTERIOR' },
          { url: 'https://picsum.photos/seed/gbp3/800/600', type: 'TEAM' },
        ],
        verificationState: 'VERIFIED',
      },
    ];
  }

  private mockReviews(locationKey: string): GbpRemoteReview[] {
    const now = Date.now();
    const day = 86400000;
    const samples: Array<{
      r: number;
      n: string;
      c: string;
      reply?: string;
    }> = [
      {
        r: 5,
        n: 'Emma T.',
        c: 'Incredible results — our organic traffic doubled in 3 months. The team explains everything clearly.',
        reply: 'Thank you Emma! Delighted to be part of your growth journey.',
      },
      {
        r: 5,
        n: 'James R.',
        c: 'Very professional team. They rebuilt our site and our local ranking went from page 3 to top 5.',
      },
      {
        r: 4,
        n: 'Priya K.',
        c: 'Good communication and solid reporting. Would like faster turnaround on content edits.',
      },
      {
        r: 5,
        n: 'Oliver B.',
        c: 'Best marketing agency we have worked with. Strategy is clear and results speak for themselves.',
      },
      {
        r: 2,
        n: 'Sam D.',
        c: 'Initial onboarding was rough, but they recovered well. Expected more hand-holding for the price.',
      },
      {
        r: 5,
        n: 'Layla S.',
        c: 'Love the dashboard and the monthly insights. Highly recommend.',
      },
    ];
    return samples.map((s, i) => ({
      googleReviewId: `${locationKey}/reviews/mock-${i + 1}`,
      reviewerName: s.n,
      reviewerPhoto: `https://i.pravatar.cc/80?u=${encodeURIComponent(s.n)}`,
      rating: s.r,
      comment: s.c,
      language: 'en',
      replyText: s.reply,
      repliedAt: s.reply ? new Date(now - i * day - 3 * 3600_000) : null,
      createdAt: new Date(now - (i + 1) * 4 * day),
    }));
  }

  private mockInsights(months: number): GbpRemoteMetricPoint[] {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    const base = {
      BUSINESS_IMPRESSIONS_MOBILE_MAPS: 4200,
      BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 1100,
      BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 3800,
      BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 1500,
      WEBSITE_CLICKS: 640,
      CALL_CLICKS: 180,
      BUSINESS_DIRECTION_REQUESTS: 95,
      BUSINESS_BOOKINGS: 22,
    };
    return Object.entries(base).map(([metric, v]) => ({
      metric,
      value: Math.round(v * months),
      periodStart: start,
      periodEnd: end,
    }));
  }
}
