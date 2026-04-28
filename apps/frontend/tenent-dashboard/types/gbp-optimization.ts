export type GbpPostType = 'UPDATE' | 'OFFER' | 'EVENT' | 'PRODUCT';
export type GbpPostStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';

export interface GbpConnectionStatus {
  connected: boolean;
  hasGbpScope: boolean;
  locationCount: number;
  connectedAt?: string;
}

export interface GbpLocation {
  id: string;
  userId: string;
  googleLocationId: string;
  googleAccountId?: string | null;
  name: string;
  storeCode?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  primaryCategory?: string | null;
  additionalCategories?: string[] | null;
  description?: string | null;
  hours?: Record<string, Array<{ open: string; close: string }>> | null;
  photos?: Array<{ url: string; type: string }> | null;
  verificationState?: string | null;
  completenessScore: number;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { reviews: number; posts: number; edits?: number };
}

export interface GbpInsightTotals {
  profileViewsMaps: number;
  profileViewsSearch: number;
  websiteClicks: number;
  callClicks: number;
  directionRequests: number;
  bookingClicks: number;
}

export interface GbpMonthlyTrendPoint {
  month: string;
  profileViews: number;
  websiteClicks: number;
  calls: number;
  directions: number;
}

export interface GbpInsights {
  periodMonths: number;
  periodStart: string;
  periodEnd: string;
  totals: GbpInsightTotals;
  monthlyTrend: GbpMonthlyTrendPoint[];
}

export interface GbpReview {
  id: string;
  locationId: string;
  googleReviewId: string;
  reviewerName?: string | null;
  reviewerPhoto?: string | null;
  rating: number;
  comment?: string | null;
  language?: string | null;
  replyText?: string | null;
  repliedAt?: string | null;
  repliedBy?: string | null;
  sentiment?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GbpReviewsResponse {
  reviews: GbpReview[];
  total: number;
  page: number;
  totalPages: number;
  avgRating: number;
  unrepliedCount: number;
}

export interface GbpPost {
  id: string;
  userId: string;
  locationId: string;
  type: GbpPostType;
  status: GbpPostStatus;
  content: string;
  mediaUrl?: string | null;
  ctaType?: string | null;
  ctaUrl?: string | null;
  couponCode?: string | null;
  offerTerms?: string | null;
  eventTitle?: string | null;
  eventStart?: string | null;
  eventEnd?: string | null;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  googlePostId?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GbpPostsResponse {
  posts: GbpPost[];
  total: number;
  page: number;
  totalPages: number;
}

export interface GbpEditSuggestion {
  id: string;
  locationId: string;
  field: string;
  currentValue: any;
  suggestedValue: any;
  source?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  detectedAt: string;
  resolvedAt?: string | null;
}

export interface GbpAiPostDraft {
  content: string;
  ctaType: string;
}
