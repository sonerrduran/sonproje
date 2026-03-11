import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SubscriptionPlansService, PlanId, BillingCycle } from './subscription-plans.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly plans: SubscriptionPlansService,
  ) {}

  // ─── Active Subscription ──────────────────────────────────

  async getSubscription(schoolId: string) {
    const sub = await this.prisma.schoolSubscription.findFirst({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) return { status: 'NONE', plan: null };

    const plan = this.plans.findById(sub.planId as PlanId);
    const daysRemaining = sub.currentPeriodEnd
      ? Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / 86_400_000)
      : 0;

    const trialActive = sub.trialEnd ? sub.trialEnd > new Date() : false;

    return { ...sub, plan, daysRemaining, trialActive };
  }

  // ─── Payment History ──────────────────────────────────────

  async getPaymentHistory(
    schoolId: string,
    params: { page?: number; limit?: number },
  ) {
    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where: { schoolId } }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  // ─── Billing Summary ──────────────────────────────────────

  async getBillingSummary(schoolId: string) {
    const cacheKey = `billing:summary:${schoolId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const [sub, totalPaid, lastPayment] = await Promise.all([
      this.getSubscription(schoolId),
      this.prisma.payment.aggregate({
        where: { schoolId, status: 'PAID' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payment.findFirst({
        where: { schoolId, status: 'PAID' },
        orderBy: { paidAt: 'desc' },
      }),
    ]);

    const result = {
      subscription: sub,
      totalPaidUsd: totalPaid._sum.amount ?? 0,
      totalPayments: totalPaid._count,
      lastPayment,
    };

    await this.redis.set(cacheKey, result, 300);
    return result;
  }

  // ─── Plan Usage ───────────────────────────────────────────

  async getPlanUsage(schoolId: string) {
    const sub = await this.prisma.schoolSubscription.findFirst({
      where: { schoolId, status: 'ACTIVE' },
    });
    if (!sub) return null;

    const plan = this.plans.findById(sub.planId as PlanId);
    const { limits } = plan;

    const [students, teachers, games, classrooms] = await Promise.all([
      this.prisma.user.count({ where: { schoolId, role: 'STUDENT', status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { schoolId, role: 'TEACHER', status: 'ACTIVE' } }),
      this.prisma.game.count({ where: { schoolId } }),
      this.prisma.classroom.count({ where: { schoolId } }),
    ]);

    const pct = (used: number, max: number) =>
      max > 0 ? Math.round((used / max) * 100) : 0;

    return {
      planId: sub.planId,
      planName: plan.name,
      usage: {
        students: { used: students, max: limits.maxStudents, pct: pct(students, limits.maxStudents) },
        teachers: { used: teachers, max: limits.maxTeachers, pct: pct(teachers, limits.maxTeachers) },
        games: { used: games, max: limits.maxGames, pct: pct(games, limits.maxGames) },
        classrooms: { used: classrooms, max: limits.maxClassrooms, pct: pct(classrooms, limits.maxClassrooms) },
        storageGB: { used: 0, max: limits.maxStorageGB, pct: 0 }, // updated when Media module reports usage
        aiGenerationsToday: { used: 0, max: limits.aiGenerationsPerDay, pct: 0 },
      },
      features: {
        customBranding: limits.customBranding,
        analyticsAccess: limits.analyticsAccess,
        prioritySupport: limits.prioritySupport,
        apiAccess: limits.apiAccess,
      },
    };
  }

  // ─── Super Admin: Platform Revenue ────────────────────────

  async getPlatformRevenue(params: { from?: Date; to?: Date }) {
    const where = {
      status: 'PAID' as const,
      ...(params.from && { paidAt: { gte: params.from } }),
      ...(params.to && { paidAt: { lte: params.to } }),
    };

    const [totalRevenue, byMonth, activeSubscriptions, planDistribution] = await Promise.all([
      this.prisma.payment.aggregate({ where, _sum: { amount: true }, _count: true }),
      this.prisma.payment.groupBy({
        by: ['createdAt'],
        where,
        _sum: { amount: true },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.prisma.schoolSubscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.schoolSubscription.groupBy({
        by: ['planId'],
        where: { status: 'ACTIVE' },
        _count: true,
      }),
    ]);

    return {
      totalRevenueUsd: totalRevenue._sum.amount ?? 0,
      totalPayments: totalRevenue._count,
      activeSubscriptions,
      planDistribution: planDistribution.map((p) => ({
        planId: p.planId,
        count: p._count,
      })),
      recentMonths: byMonth,
    };
  }
}
