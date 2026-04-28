import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GbpApiService, GbpRemoteLocation } from './gbp-api.service';

const GBP_SCOPE = 'https://www.googleapis.com/auth/business.manage';

@Injectable()
export class GbpOptimizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gbpApi: GbpApiService,
  ) {}

  // ─── CONNECTION STATUS ─────────────────────────────────

  async getConnectionStatus(userId: string) {
    const conn = await this.prisma.googleConnection.findUnique({
      where: { userId },
    });

    if (!conn) {
      return { connected: false, hasGbpScope: false, locationCount: 0 };
    }

    const hasGbpScope = (conn.scope || '').includes(GBP_SCOPE);
    const locationCount = await this.prisma.gbpLocation.count({
      where: { userId },
    });

    return {
      connected: true,
      hasGbpScope,
      locationCount,
      connectedAt: conn.connectedAt,
    };
  }

  // ─── LOCATIONS ─────────────────────────────────────────

  async listLocations(userId: string) {
    const locations = await this.prisma.gbpLocation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { reviews: true, posts: true } },
      },
    });
    return locations;
  }

  async getLocation(userId: string, locationId: string) {
    const location = await this.prisma.gbpLocation.findUnique({
      where: { id: locationId },
      include: {
        _count: { select: { reviews: true, posts: true, edits: true } },
      },
    });
    if (!location) throw new NotFoundException('Location not found');
    if (location.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return location;
  }

  async syncLocationsFromGoogle(userId: string) {
    const remoteLocations: GbpRemoteLocation[] =
      await this.gbpApi.listLocations(userId);

    const saved = await Promise.all(
      remoteLocations.map((remote) =>
        this.prisma.gbpLocation.upsert({
          where: {
            userId_googleLocationId: {
              userId,
              googleLocationId: remote.googleLocationId,
            },
          },
          create: {
            userId,
            googleLocationId: remote.googleLocationId,
            googleAccountId: remote.googleAccountId,
            name: remote.name,
            storeCode: remote.storeCode,
            phone: remote.phone,
            websiteUrl: remote.websiteUrl,
            addressLine1: remote.addressLine1,
            addressLine2: remote.addressLine2,
            city: remote.city,
            region: remote.region,
            postalCode: remote.postalCode,
            countryCode: remote.countryCode,
            latitude: remote.latitude,
            longitude: remote.longitude,
            primaryCategory: remote.primaryCategory,
            additionalCategories: remote.additionalCategories as any,
            description: remote.description,
            hours: remote.hours as any,
            attributes: remote.attributes as any,
            photos: remote.photos as any,
            verificationState: remote.verificationState,
            completenessScore: this.computeCompleteness(remote),
            lastSyncedAt: new Date(),
          },
          update: {
            googleAccountId: remote.googleAccountId,
            name: remote.name,
            storeCode: remote.storeCode,
            phone: remote.phone,
            websiteUrl: remote.websiteUrl,
            addressLine1: remote.addressLine1,
            addressLine2: remote.addressLine2,
            city: remote.city,
            region: remote.region,
            postalCode: remote.postalCode,
            countryCode: remote.countryCode,
            latitude: remote.latitude,
            longitude: remote.longitude,
            primaryCategory: remote.primaryCategory,
            additionalCategories: remote.additionalCategories as any,
            description: remote.description,
            hours: remote.hours as any,
            attributes: remote.attributes as any,
            photos: remote.photos as any,
            verificationState: remote.verificationState,
            completenessScore: this.computeCompleteness(remote),
            lastSyncedAt: new Date(),
          },
        }),
      ),
    );

    return { synced: saved.length, locations: saved };
  }

  async updateLocation(
    userId: string,
    locationId: string,
    patch: any,
  ) {
    const location = await this.getLocation(userId, locationId);

    const allowed: Record<string, any> = {};
    const fields = [
      'name',
      'phone',
      'websiteUrl',
      'addressLine1',
      'addressLine2',
      'city',
      'region',
      'postalCode',
      'countryCode',
      'primaryCategory',
      'description',
      'hours',
      'additionalCategories',
      'attributes',
    ];
    for (const f of fields) {
      if (patch[f] !== undefined) allowed[f] = patch[f];
    }
    if (Object.keys(allowed).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    // Push to Google (mockable)
    await this.gbpApi.updateLocation(userId, location.googleLocationId, allowed);

    const updated = await this.prisma.gbpLocation.update({
      where: { id: locationId },
      data: {
        ...allowed,
        completenessScore: this.computeCompleteness({
          ...location,
          ...allowed,
        } as any),
        lastSyncedAt: new Date(),
      },
    });
    return updated;
  }

  // ─── EDIT SUGGESTIONS ──────────────────────────────────

  async listEditSuggestions(userId: string, locationId: string) {
    await this.getLocation(userId, locationId);
    return this.prisma.gbpEditSuggestion.findMany({
      where: { locationId },
      orderBy: { detectedAt: 'desc' },
    });
  }

  async resolveEditSuggestion(
    userId: string,
    suggestionId: string,
    action: 'approve' | 'reject',
  ) {
    const suggestion = await this.prisma.gbpEditSuggestion.findUnique({
      where: { id: suggestionId },
      include: { location: true },
    });
    if (!suggestion) throw new NotFoundException('Edit suggestion not found');
    if (suggestion.location.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    const updated = await this.prisma.gbpEditSuggestion.update({
      where: { id: suggestionId },
      data: { status, resolvedAt: new Date() },
    });

    if (action === 'approve' && suggestion.suggestedValue) {
      await this.prisma.gbpLocation.update({
        where: { id: suggestion.locationId },
        data: { [suggestion.field]: suggestion.suggestedValue as any } as any,
      });
    }

    return updated;
  }

  // ─── HELPERS ───────────────────────────────────────────

  private computeCompleteness(loc: Partial<GbpRemoteLocation>): number {
    const checks: boolean[] = [
      !!loc.name,
      !!loc.phone,
      !!loc.websiteUrl,
      !!loc.addressLine1,
      !!loc.city,
      !!loc.postalCode,
      !!loc.primaryCategory,
      !!loc.description && (loc.description as string).length >= 50,
      !!loc.hours,
      Array.isArray(loc.photos) && loc.photos.length >= 3,
    ];
    const score = (checks.filter(Boolean).length / checks.length) * 100;
    return Math.round(score);
  }
}
