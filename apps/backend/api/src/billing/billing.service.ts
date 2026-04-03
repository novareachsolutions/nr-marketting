import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_LIMITS } from '../common/constants/plan-limits';
import { CreateCheckoutDto } from './dto';

@Injectable()
export class BillingService {
  private stripe: Stripe;
  private priceMap: Record<string, string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.configService.getOrThrow<string>('STRIPE_SECRET_KEY'),
      { apiVersion: '2023-10-16' },
    );

    this.priceMap = {
      PRO_MONTHLY: this.configService.get('STRIPE_PRICE_PRO_MONTHLY', ''),
      PRO_YEARLY: this.configService.get('STRIPE_PRICE_PRO_YEARLY', ''),
      AGENCY_MONTHLY: this.configService.get('STRIPE_PRICE_AGENCY_MONTHLY', ''),
      AGENCY_YEARLY: this.configService.get('STRIPE_PRICE_AGENCY_YEARLY', ''),
    };
  }

  // ─── CREATE STRIPE CUSTOMER ────────────────────────────

  async createStripeCustomer(email: string, name?: string): Promise<string> {
    const customer = await this.stripe.customers.create({
      email,
      name: name || undefined,
    });
    return customer.id;
  }

  // ─── CREATE CHECKOUT SESSION ───────────────────────────

  async createCheckoutSession(userId: string, dto: CreateCheckoutDto) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription record not found');
    }

    const cycle = dto.billingCycle || 'MONTHLY';
    const priceKey = `${dto.plan}_${cycle}`;
    const priceId = this.priceMap[priceKey];

    if (!priceId) {
      throw new BadRequestException(
        `Price not configured for ${dto.plan} ${cycle}. Set STRIPE_PRICE_${priceKey} env var.`,
      );
    }

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    const session = await this.stripe.checkout.sessions.create({
      customer: subscription.stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/billing/cancelled`,
      metadata: { userId },
    });

    return { checkoutUrl: session.url };
  }

  // ─── CREATE PORTAL SESSION ─────────────────────────────

  async createPortalSession(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription record not found');
    }

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${frontendUrl}/settings/billing`,
    });

    return { portalUrl: session.url };
  }

  // ─── GET SUBSCRIPTION ──────────────────────────────────

  async getSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return {
      plan: subscription.plan,
      billingCycle: subscription.billingCycle,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }

  // ─── GET USAGE ─────────────────────────────────────────

  async getUsage(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    const period = this.getCurrentPeriod();

    const usageRecords = await this.prisma.usageRecord.findMany({
      where: { userId, period },
    });

    const usage: Record<string, { count: number; limit: number }> = {};
    for (const record of usageRecords) {
      usage[record.metric] = { count: record.count, limit: record.limit };
    }

    return {
      plan: subscription?.plan || 'FREE',
      period,
      usage,
    };
  }

  // ─── WEBHOOK HANDLER ───────────────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.configService.getOrThrow<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
    }

    return { received: true };
  }

  // ─── WEBHOOK: checkout.session.completed ───────────────

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    if (!userId) return;

    const stripeSubscriptionId = session.subscription as string;
    const stripeSub = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
    const priceId = stripeSub.items.data[0]?.price.id;
    const plan = this.getPlanFromPriceId(priceId);
    const cycle = this.getCycleFromPriceId(priceId);

    await this.prisma.subscription.update({
      where: { userId },
      data: {
        stripeSubscriptionId,
        plan,
        billingCycle: cycle,
        status: 'ACTIVE',
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      },
    });

    await this.updateUsageLimits(userId, plan);
  }

  // ─── WEBHOOK: invoice.paid ─────────────────────────────

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
    });
    if (!subscription) return;

    // Update period dates if subscription exists on Stripe
    if (invoice.subscription) {
      const stripeSub = await this.stripe.subscriptions.retrieve(
        invoice.subscription as string,
      );
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        },
      });
    }

    // Reset monthly usage counters
    const period = this.getCurrentPeriod();
    await this.prisma.usageRecord.updateMany({
      where: { userId: subscription.userId, period },
      data: { count: 0 },
    });
  }

  // ─── WEBHOOK: invoice.payment_failed ───────────────────

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    await this.prisma.subscription.updateMany({
      where: { stripeCustomerId: customerId },
      data: { status: 'PAST_DUE' },
    });

    // TODO: Send payment failed email
  }

  // ─── WEBHOOK: customer.subscription.updated ────────────

  private async handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
    const customerId = stripeSub.customer as string;
    const priceId = stripeSub.items.data[0]?.price.id;
    const plan = this.getPlanFromPriceId(priceId);
    const cycle = this.getCycleFromPriceId(priceId);

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
    });
    if (!subscription) return;

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan,
        billingCycle: cycle,
        status: stripeSub.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
    });

    await this.updateUsageLimits(subscription.userId, plan);
  }

  // ─── WEBHOOK: customer.subscription.deleted ────────────

  private async handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
    const customerId = stripeSub.customer as string;
    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
    });
    if (!subscription) return;

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan: 'FREE',
        status: 'CANCELLED',
        stripeSubscriptionId: null,
        cancelAtPeriodEnd: false,
      },
    });

    await this.updateUsageLimits(subscription.userId, 'FREE');

    // TODO: Send cancellation email
  }

  // ─── HELPERS ───────────────────────────────────────────

  private getPlanFromPriceId(priceId: string): 'FREE' | 'PRO' | 'AGENCY' {
    if (
      priceId === this.priceMap.PRO_MONTHLY ||
      priceId === this.priceMap.PRO_YEARLY
    ) {
      return 'PRO';
    }
    if (
      priceId === this.priceMap.AGENCY_MONTHLY ||
      priceId === this.priceMap.AGENCY_YEARLY
    ) {
      return 'AGENCY';
    }
    return 'FREE';
  }

  private getCycleFromPriceId(priceId: string): 'MONTHLY' | 'YEARLY' {
    if (
      priceId === this.priceMap.PRO_YEARLY ||
      priceId === this.priceMap.AGENCY_YEARLY
    ) {
      return 'YEARLY';
    }
    return 'MONTHLY';
  }

  private async updateUsageLimits(userId: string, plan: string) {
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.FREE;
    const period = this.getCurrentPeriod();

    const metricLimits = [
      { metric: 'KEYWORDS_TRACKED' as const, limit: limits.maxTrackedKeywordsPerProject },
      { metric: 'PAGES_CRAWLED' as const, limit: limits.maxPagesPerCrawl },
      { metric: 'AI_CREDITS' as const, limit: limits.maxAiMessagesPerMonth },
      { metric: 'REPORTS_GENERATED' as const, limit: limits.maxReportsPerMonth },
    ];

    for (const { metric, limit } of metricLimits) {
      await this.prisma.usageRecord.upsert({
        where: { userId_metric_period: { userId, metric, period } },
        update: { limit: limit === -1 ? 999999 : limit },
        create: { userId, metric, period, count: 0, limit: limit === -1 ? 999999 : limit },
      });
    }
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
