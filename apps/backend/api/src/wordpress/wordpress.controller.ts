import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';
import { WordPressService } from './wordpress.service';
import { ConnectWordPressDto } from './dto/connect-wordpress.dto';

@Controller('projects/:id/wordpress')
@UseGuards(JwtAuthGuard, ProjectOwnerGuard)
export class WordPressController {
  constructor(private readonly wordpressService: WordPressService) {}

  @Post('connect')
  async connect(
    @Param('id') projectId: string,
    @Body() dto: ConnectWordPressDto,
  ) {
    return this.wordpressService.connect(projectId, dto);
  }

  @Get('status')
  async getStatus(@Param('id') projectId: string) {
    return this.wordpressService.getConnection(projectId);
  }

  @Post('verify')
  async verify(@Param('id') projectId: string) {
    return this.wordpressService.verifyConnection(projectId);
  }

  @Delete('disconnect')
  async disconnect(@Param('id') projectId: string) {
    return this.wordpressService.disconnect(projectId);
  }
}
