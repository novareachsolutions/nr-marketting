import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiSuggestionsService } from './ai-suggestions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class AiSuggestionsController {
  constructor(private readonly aiSuggestionsService: AiSuggestionsService) {}

  @Post('ai-suggestions')
  async getSuggestions(
    @Body() body: { module: string; context: Record<string, any> },
  ): Promise<any> {
    const data = await this.aiSuggestionsService.getSuggestions(
      body.module,
      body.context,
    );
    return { success: true, data };
  }
}
