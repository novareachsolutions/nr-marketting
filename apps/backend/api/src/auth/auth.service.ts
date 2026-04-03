import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly BCRYPT_ROUNDS = 12;
  private readonly REFRESH_TOKEN_DAYS = 30;
  private readonly RESET_TOKEN_HOURS = 1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly billingService: BillingService,
  ) {}

  // ─── REGISTER ──────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);
    const emailVerifyToken = randomBytes(32).toString('hex');

    // Create Stripe customer (falls back to temp ID if Stripe not configured)
    let stripeCustomerId: string;
    try {
      stripeCustomerId = await this.billingService.createStripeCustomer(
        dto.email.toLowerCase().trim(),
        dto.name,
      );
    } catch {
      stripeCustomerId = `temp_${randomBytes(16).toString('hex')}`;
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        name: dto.name ?? null,
        emailVerifyToken,
        subscription: {
          create: {
            stripeCustomerId,
            plan: 'FREE',
            status: 'ACTIVE',
          },
        },
      },
    });

    // Initialize usage records for the current period
    const period = this.getCurrentPeriod();
    const freeMetrics = [
      { metric: 'KEYWORDS_TRACKED' as const, limit: 10 },
      { metric: 'PAGES_CRAWLED' as const, limit: 100 },
      { metric: 'AI_CREDITS' as const, limit: 10 },
      { metric: 'REPORTS_GENERATED' as const, limit: 1 },
    ];

    await this.prisma.usageRecord.createMany({
      data: freeMetrics.map((m) => ({
        userId: user.id,
        metric: m.metric,
        count: 0,
        limit: m.limit,
        period,
      })),
    });

    // TODO: Send verification email via email service
    // await this.emailService.sendVerificationEmail(user.email, emailVerifyToken);

    return {
      message: 'Registration successful. Check your email to verify your account.',
    };
  }

  // ─── LOGIN ─────────────────────────────────────────────────

  async login(dto: LoginDto, userAgent?: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: { subscription: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException(
        'Email not verified. Please check your inbox or request a new verification email.',
      );
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const { rawToken: refreshToken, hash: refreshTokenHash } =
      this.generateRefreshToken();

    // Store refresh token hash
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        userAgent: userAgent ?? null,
        ipAddress: ipAddress ?? null,
        expiresAt: new Date(
          Date.now() + this.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    });

    // Clean up expired tokens for this user
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
        expiresAt: { lt: new Date() },
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.subscription?.plan ?? 'FREE',
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  // ─── REFRESH ───────────────────────────────────────────────

  async refresh(rawRefreshToken: string) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    const tokenHash = this.hashToken(rawRefreshToken);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { include: { subscription: true } },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Token rotation: delete old, create new
    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    const accessToken = this.generateAccessToken(storedToken.user);
    const { rawToken: newRefreshToken, hash: newRefreshTokenHash } =
      this.generateRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: storedToken.userId,
        tokenHash: newRefreshTokenHash,
        userAgent: storedToken.userAgent,
        ipAddress: storedToken.ipAddress,
        expiresAt: new Date(
          Date.now() + this.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  // ─── LOGOUT ────────────────────────────────────────────────

  async logout(rawRefreshToken: string) {
    if (!rawRefreshToken) return;

    const tokenHash = this.hashToken(rawRefreshToken);

    await this.prisma.refreshToken.deleteMany({
      where: { tokenHash },
    });
  }

  // ─── VERIFY EMAIL ──────────────────────────────────────────

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Verification token required');
    }

    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifyToken: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  // ─── RESEND VERIFICATION ──────────────────────────────────

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || user.isEmailVerified) {
      // Don't reveal if user exists or is already verified
      return {
        message: 'If an account exists with this email, a verification link has been sent.',
      };
    }

    const emailVerifyToken = randomBytes(32).toString('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken },
    });

    // TODO: Send verification email
    // await this.emailService.sendVerificationEmail(user.email, emailVerifyToken);

    return {
      message: 'If an account exists with this email, a verification link has been sent.',
    };
  }

  // ─── FORGOT PASSWORD ──────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    // Always return same response (don't reveal if email exists)
    const response = {
      message: 'If an account exists with this email, a reset link has been sent.',
    };

    if (!user) return response;

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpiry: new Date(
          Date.now() + this.RESET_TOKEN_HOURS * 60 * 60 * 1000,
        ),
      },
    });

    // TODO: Send reset email with rawToken
    // await this.emailService.sendPasswordResetEmail(user.email, rawToken);

    return response;
  }

  // ─── RESET PASSWORD ───────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      // Update password and clear reset token
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      }),
      // Invalidate all refresh tokens (force re-login everywhere)
      this.prisma.refreshToken.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    return {
      message: 'Password reset successful. Please log in with your new password.',
    };
  }

  // ─── GET ME ────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.subscription?.plan ?? 'FREE',
      isEmailVerified: user.isEmailVerified,
      timezone: user.timezone,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }

  // ─── HELPERS ───────────────────────────────────────────────

  private generateAccessToken(user: any): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      plan: user.subscription?.plan ?? 'FREE',
    };

    return this.jwtService.sign(payload);
  }

  private generateRefreshToken(): { rawToken: string; hash: string } {
    const rawToken = randomBytes(32).toString('hex');
    const hash = this.hashToken(rawToken);
    return { rawToken, hash };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
