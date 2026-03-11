import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type PlanId = 'STARTER' | 'PRO' | 'ENTERPRISE';
export type BillingCycle = 'MONTHLY' | 'YEARLY';

export interface PlanLimits {
  maxStudents: number;
  maxTeachers: number;
  maxStorageGB: number;
  aiGenerationsPerDay: number;
  maxGames: number;
  maxClassrooms: number;
  customBranding: boolean;
  analyticsAccess: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
}

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  description: string;
  monthlyPriceUsd: number;
  yearlyPriceUsd: number;
  stripePriceIdMonthly: string;
  stripePriceIdYearly: string;
  limits: PlanLimits;
  highlighted?: boolean;
}

const PLANS: SubscriptionPlan[] = [
  {
    id: 'STARTER',
    name: 'Starter',
    description: 'Perfect for small schools getting started with digital learning.',
    monthlyPriceUsd: 29,
    yearlyPriceUsd: 290, // ~17% discount
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? 'price_starter_monthly',
    stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY ?? 'price_starter_yearly',
    limits: {
      maxStudents: 200,
      maxTeachers: 10,
      maxStorageGB: 5,
      aiGenerationsPerDay: 20,
      maxGames: 50,
      maxClassrooms: 10,
      customBranding: false,
      analyticsAccess: false,
      prioritySupport: false,
      apiAccess: false,
    },
  },
  {
    id: 'PRO',
    name: 'Pro',
    description: 'For growing schools that need more power and analytics.',
    monthlyPriceUsd: 79,
    yearlyPriceUsd: 790,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? 'price_pro_monthly',
    stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? 'price_pro_yearly',
    highlighted: true,
    limits: {
      maxStudents: 1000,
      maxTeachers: 50,
      maxStorageGB: 50,
      aiGenerationsPerDay: 200,
      maxGames: 500,
      maxClassrooms: 100,
      customBranding: true,
      analyticsAccess: true,
      prioritySupport: false,
      apiAccess: false,
    },
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Unlimited scale with custom pricing, branding, and SLA.',
    monthlyPriceUsd: 0, // Custom pricing
    yearlyPriceUsd: 0,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? 'price_enterprise_monthly',
    stripePriceIdYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY ?? 'price_enterprise_yearly',
    limits: {
      maxStudents: 100_000,
      maxTeachers: 5_000,
      maxStorageGB: 1000,
      aiGenerationsPerDay: 2000,
      maxGames: 10_000,
      maxClassrooms: 10_000,
      customBranding: true,
      analyticsAccess: true,
      prioritySupport: true,
      apiAccess: true,
    },
  },
];

@Injectable()
export class SubscriptionPlansService {
  private readonly registry = new Map<PlanId, SubscriptionPlan>(
    PLANS.map((p) => [p.id, p]),
  );

  constructor(private readonly prisma: PrismaService) {}

  findAll(): SubscriptionPlan[] {
    return PLANS;
  }

  findById(id: PlanId): SubscriptionPlan {
    const plan = this.registry.get(id);
    if (!plan) throw new Error(`Plan "${id}" not found`);
    return plan;
  }

  findByStripePriceId(priceId: string): SubscriptionPlan | undefined {
    return PLANS.find(
      (p) => p.stripePriceIdMonthly === priceId || p.stripePriceIdYearly === priceId,
    );
  }

  getPlanFromPriceId(priceId: string): { plan: SubscriptionPlan; cycle: BillingCycle } | undefined {
    for (const plan of PLANS) {
      if (plan.stripePriceIdMonthly === priceId) return { plan, cycle: 'MONTHLY' };
      if (plan.stripePriceIdYearly === priceId) return { plan, cycle: 'YEARLY' };
    }
    return undefined;
  }

  // ─── Limit Enforcement ────────────────────────────────────

  async checkLimit(
    schoolId: string,
    resource: 'students' | 'teachers' | 'games' | 'classrooms',
  ): Promise<void> {
    const subscription = await this.getActiveSubscription(schoolId);
    if (!subscription) {
      throw new ForbiddenException('No active subscription. Please subscribe to a plan.');
    }

    const plan = this.findById(subscription.planId as PlanId);
    const limits = plan.limits;

    const counts: Record<string, () => Promise<number>> = {
      students: () => this.prisma.user.count({ where: { schoolId, role: 'STUDENT', status: 'ACTIVE' } }),
      teachers: () => this.prisma.user.count({ where: { schoolId, role: 'TEACHER', status: 'ACTIVE' } }),
      games: () => this.prisma.game.count({ where: { schoolId } }),
      classrooms: () => this.prisma.classroom.count({ where: { schoolId } }),
    };

    const limitMap: Record<string, number> = {
      students: limits.maxStudents,
      teachers: limits.maxTeachers,
      games: limits.maxGames,
      classrooms: limits.maxClassrooms,
    };

    const current = await counts[resource]();
    const max = limitMap[resource];

    if (current >= max) {
      throw new ForbiddenException(
        `Plan limit reached: your ${plan.name} plan allows up to ${max} ${resource}. ` +
        `Upgrade to Pro or Enterprise to add more.`,
      );
    }
  }

  async getActiveSubscription(schoolId: string) {
    return this.prisma.schoolSubscription.findFirst({
      where: { schoolId, status: 'ACTIVE', currentPeriodEnd: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async hasFeature(schoolId: string, feature: keyof PlanLimits): Promise<boolean> {
    const sub = await this.getActiveSubscription(schoolId);
    if (!sub) return false;
    const plan = this.registry.get(sub.planId as PlanId);
    if (!plan) return false;
    const val = plan.limits[feature];
    return typeof val === 'boolean' ? val : (val as number) > 0;
  }
}
