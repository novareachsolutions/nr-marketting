import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  private readonly REFRESH_TOKEN_COOKIE = 'refreshToken';
  private readonly REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto);
    return { success: true, data };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers['user-agent'];
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip;

    const { accessToken, refreshToken, user } = await this.authService.login(
      dto,
      userAgent,
      ipAddress,
    );

    this.setRefreshTokenCookie(res, refreshToken);

    return { success: true, data: { accessToken, user } };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.[this.REFRESH_TOKEN_COOKIE];
    const { accessToken, refreshToken } =
      await this.authService.refresh(rawRefreshToken);

    this.setRefreshTokenCookie(res, refreshToken);

    return { success: true, data: { accessToken } };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.[this.REFRESH_TOKEN_COOKIE];
    await this.authService.logout(rawRefreshToken);

    res.clearCookie(this.REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/api/auth',
    });

    return { success: true, data: { message: 'Logged out successfully' } };
  }

  @Get('verify-email')
  async verifyEmail(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    try {
      await this.authService.verifyEmail(token);
      return res.redirect(`${frontendUrl}/login?verified=true`);
    } catch {
      return res.redirect(`${frontendUrl}/login?verified=false`);
    }
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body('email') email: string) {
    const data = await this.authService.resendVerification(email);
    return { success: true, data };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const data = await this.authService.forgotPassword(dto);
    return { success: true, data };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const data = await this.authService.resetPassword(dto);
    return { success: true, data };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser('id') userId: string) {
    const data = await this.authService.getMe(userId);
    return { success: true, data };
  }

  // ─── HELPERS ───────────────────────────────────────────────

  private setRefreshTokenCookie(res: Response, token: string) {
    res.cookie(this.REFRESH_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: this.REFRESH_TOKEN_MAX_AGE,
    });
  }
}
