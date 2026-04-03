import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ─── CREATE CHECKOUT SESSION ───────────────────────────

  @Post('create-checkout-session')
  @UseGuards(JwtAuthGuard)
  async createCheckoutSession(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCheckoutDto,
  ) {
    const data = await this.billingService.createCheckoutSession(userId, dto);
    return { success: true, data };
  }

  // ─── CREATE PORTAL SESSION ─────────────────────────────

  @Post('create-portal-session')
  @UseGuards(JwtAuthGuard)
  async createPortalSession(@CurrentUser('id') userId: string) {
    const data = await this.billingService.createPortalSession(userId);
    return { success: true, data };
  }

  // ─── GET SUBSCRIPTION ──────────────────────────────────

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  async getSubscription(@CurrentUser('id') userId: string) {
    const data = await this.billingService.getSubscription(userId);
    return { success: true, data };
  }

  // ─── GET USAGE ─────────────────────────────────────────

  @Get('usage')
  @UseGuards(JwtAuthGuard)
  async getUsage(@CurrentUser('id') userId: string) {
    const data = await this.billingService.getUsage(userId);
    return { success: true, data };
  }

  // ─── STRIPE WEBHOOK ────────────────────────────────────

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
  ) {
    const signature = req.headers['stripe-signature'] as string;
    const rawBody = req.rawBody;

    if (!rawBody || !signature) {
      return { success: false, error: 'Missing body or signature' };
    }

    const data = await this.billingService.handleWebhook(rawBody, signature);
    return { success: true, data };
  }
}
