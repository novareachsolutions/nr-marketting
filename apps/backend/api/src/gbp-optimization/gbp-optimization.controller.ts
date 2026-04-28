import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { GbpOptimizationService } from './gbp-optimization.service';
import { GbpInsightsService } from './gbp-insights.service';
import { GbpReviewsService } from './gbp-reviews.service';
import { GbpPostsService } from './gbp-posts.service';
import { GbpAiService } from './gbp-ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GbpPostType } from '@prisma/client';

@Controller('gbp')
@UseGuards(JwtAuthGuard)
export class GbpOptimizationController {
  constructor(
    private readonly gbpService: GbpOptimizationService,
    private readonly insightsService: GbpInsightsService,
    private readonly reviewsService: GbpReviewsService,
    private readonly postsService: GbpPostsService,
    private readonly aiService: GbpAiService,
  ) {}

  // ─── CONNECTION / STATUS ───────────────────────────────

  @Get('status')
  async status(@Req() req: any) {
    const data = await this.gbpService.getConnectionStatus(req.user.id);
    return { success: true, data };
  }

  // ─── LOCATIONS ─────────────────────────────────────────

  @Get('locations')
  async listLocations(@Req() req: any) {
    const data = await this.gbpService.listLocations(req.user.id);
    return { success: true, data };
  }

  @Post('locations/sync')
  async syncLocations(@Req() req: any) {
    const data = await this.gbpService.syncLocationsFromGoogle(req.user.id);
    return { success: true, data };
  }

  @Get('locations/:id')
  async getLocation(@Req() req: any, @Param('id') id: string) {
    const data = await this.gbpService.getLocation(req.user.id, id);
    return { success: true, data };
  }

  @Patch('locations/:id')
  async updateLocation(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const data = await this.gbpService.updateLocation(req.user.id, id, body);
    return { success: true, data };
  }

  // ─── INSIGHTS ──────────────────────────────────────────

  @Get('locations/:id/insights')
  async insights(
    @Req() req: any,
    @Param('id') id: string,
    @Query('months', new DefaultValuePipe(12), ParseIntPipe) months: number,
  ) {
    const data = await this.insightsService.getInsights(
      req.user.id,
      id,
      months,
    );
    return { success: true, data };
  }

  // ─── REVIEWS ───────────────────────────────────────────

  @Get('locations/:id/reviews')
  async listReviews(
    @Req() req: any,
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const data = await this.reviewsService.listReviews(
      req.user.id,
      id,
      page,
      limit,
    );
    return { success: true, data };
  }

  @Post('reviews/:id/reply')
  async replyToReview(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { reply: string },
  ) {
    const data = await this.reviewsService.replyToReview(
      req.user.id,
      id,
      body.reply,
    );
    return { success: true, data };
  }

  @Post('reviews/:id/ai-reply')
  async generateAiReply(@Req() req: any, @Param('id') id: string) {
    const data = await this.reviewsService.generateAiReply(req.user.id, id);
    return { success: true, data };
  }

  // ─── POSTS ─────────────────────────────────────────────

  @Get('locations/:id/posts')
  async listPosts(
    @Req() req: any,
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const data = await this.postsService.listPosts(
      req.user.id,
      id,
      page,
      limit,
    );
    return { success: true, data };
  }

  @Post('locations/:id/posts')
  async createPost(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      type: GbpPostType;
      content: string;
      mediaUrl?: string;
      ctaType?: string;
      ctaUrl?: string;
      couponCode?: string;
      offerTerms?: string;
      eventTitle?: string;
      eventStart?: string;
      eventEnd?: string;
      scheduledAt?: string;
    },
  ) {
    const data = await this.postsService.createPost(req.user.id, id, body);
    return { success: true, data };
  }

  @Post('locations/:id/posts/ai-draft')
  async aiDraftPost(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { type?: GbpPostType; topic?: string; tone?: string },
  ) {
    const data = await this.aiService.draftPost(req.user.id, id, body);
    return { success: true, data };
  }

  @Delete('posts/:id')
  async deletePost(@Req() req: any, @Param('id') id: string) {
    const data = await this.postsService.deletePost(req.user.id, id);
    return { success: true, data };
  }

  // ─── EDIT SUGGESTIONS ──────────────────────────────────

  @Get('locations/:id/edits')
  async listEdits(@Req() req: any, @Param('id') id: string) {
    const data = await this.gbpService.listEditSuggestions(req.user.id, id);
    return { success: true, data };
  }

  @Post('edits/:id/:action')
  async resolveEdit(
    @Req() req: any,
    @Param('id') id: string,
    @Param('action') action: 'approve' | 'reject',
  ) {
    const data = await this.gbpService.resolveEditSuggestion(
      req.user.id,
      id,
      action,
    );
    return { success: true, data };
  }
}
