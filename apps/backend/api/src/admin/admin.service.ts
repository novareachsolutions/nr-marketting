import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ListUsersQuery {
  status?: ApprovalStatus | 'ALL';
  search?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: ListUsersQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

    const where: Prisma.UserWhereInput = {};

    if (query.status && query.status !== 'ALL') {
      where.approvalStatus = query.status;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [users, total, pending, approved, rejected] =
      await this.prisma.$transaction([
        this.prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            approvalStatus: true,
            approvedAt: true,
            approvedById: true,
            rejectedAt: true,
            rejectionReason: true,
            isEmailVerified: true,
            createdAt: true,
            subscription: { select: { plan: true } },
          },
        }),
        this.prisma.user.count({ where }),
        this.prisma.user.count({ where: { approvalStatus: 'PENDING' } }),
        this.prisma.user.count({ where: { approvalStatus: 'APPROVED' } }),
        this.prisma.user.count({ where: { approvalStatus: 'REJECTED' } }),
      ]);

    const summary = { pending, approved, rejected };

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        plan: u.subscription?.plan ?? 'FREE',
        approvalStatus: u.approvalStatus,
        approvedAt: u.approvedAt,
        approvedById: u.approvedById,
        rejectedAt: u.rejectedAt,
        rejectionReason: u.rejectionReason,
        isEmailVerified: u.isEmailVerified,
        createdAt: u.createdAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      summary,
    };
  }

  async approveUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.approvalStatus === 'APPROVED') {
      throw new ConflictException('User is already approved');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        approvedById: adminId,
        rejectedAt: null,
        rejectionReason: null,
        // When the admin approves, treat the email as verified so the rest
        // of the app (which still reads isEmailVerified) keeps working.
        isEmailVerified: true,
        emailVerifyToken: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        approvalStatus: true,
        approvedAt: true,
      },
    });
  }

  async rejectUser(userId: string, adminId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'SUPER_ADMIN') {
      throw new BadRequestException('Cannot reject a super admin');
    }

    return this.prisma.$transaction(async (tx) => {
      // Revoke any existing sessions
      await tx.refreshToken.deleteMany({ where: { userId } });

      return tx.user.update({
        where: { id: userId },
        data: {
          approvalStatus: 'REJECTED',
          rejectedAt: new Date(),
          rejectionReason: reason?.trim() || null,
          approvedAt: null,
          approvedById: adminId,
        },
        select: {
          id: true,
          email: true,
          approvalStatus: true,
          rejectedAt: true,
          rejectionReason: true,
        },
      });
    });
  }
}
