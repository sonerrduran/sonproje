import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../database/prisma.service';
import { SubscriptionPlansService, PlanId, BillingCycle } from './subscription-plans.service';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly plans: SubscriptionPlansService,
  ) {
    this.stripe = new Stripe(config.get<string>('stripe.secretKey', ''), {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    });
    this.webhookSecret = config.get<string>('stripe.webhookSecret', '');
  }

  // ─── Checkout Session ─────────────────────────────────────

  async createCheckoutSession(
    schoolId: string,
    schoolAdminEmail: string,
    planId: PlanId,
    cycle: BillingCycle,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ url: string; sessionId: string }> {
    const plan = this.plans.findById(planId);
    const priceId = cycle === 'MONTHLY'
      ? plan.stripePriceIdMonthly
      : plan.stripePriceIdYearly;

    if (planId === 'ENTERPRISE') {
      throw new BadRequestException('Enterprise plans require contacting sales. Please email sales@galacticlearning.com');
    }

    // Look up or create Stripe customer for this school
    const customerId = await this.getOrCreateCustomer(schoolId, schoolAdminEmail);

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: { schoolId, planId, cycle },
        trial_period_days: 14, // 14-day free trial
      },
      metadata: { schoolId, planId, cycle },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    this.logger.log(`Checkout session created: ${session.id} [school: ${schoolId}, plan: ${planId}]`);
    return { url: session.url!, sessionId: session.id };
  }

  // ─── Subscription Management ──────────────────────────────

  async cancelSubscription(stripeSubscriptionId: string, immediately = false): Promise<void> {
    if (immediately) {
      await this.stripe.subscriptions.cancel(stripeSubscriptionId);
    } else {
      // Cancel at period end (kinder to schools)
      await this.stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }
    this.logger.log(`Subscription ${stripeSubscriptionId} cancellation (immediately: ${immediately})`);
  }

  async reactivateSubscription(stripeSubscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: false,
    });
  }

  async upgradeSubscription(
    stripeSubscriptionId: string,
    newPlanId: PlanId,
    newCycle: BillingCycle,
  ): Promise<void> {
    const plan = this.plans.findById(newPlanId);
    const newPriceId = newCycle === 'MONTHLY'
      ? plan.stripePriceIdMonthly
      : plan.stripePriceIdYearly;

    const subscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
    const itemId = subscription.items.data[0].id;

    await this.stripe.subscriptions.update(stripeSubscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'create_prorations', // Charge/credit differetial immediately
      metadata: { planId: newPlanId, cycle: newCycle },
    });

    this.logger.log(`Subscription upgraded to ${newPlanId} (${newCycle})`);
  }

  async getPortalUrl(schoolId: string, returnUrl: string): Promise<string> {
    const customerId = await this.getCustomerId(schoolId);
    if (!customerId) throw new BadRequestException('No billing account found for this school');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session.url;
  }

  // ─── Invoices ─────────────────────────────────────────────

  async listInvoices(schoolId: string, limit = 12) {
    const customerId = await this.getCustomerId(schoolId);
    if (!customerId) return [];

    const invoices = await this.stripe.invoices.list({
      customer: customerId,
      limit,
    });

    return invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amountDue: inv.amount_due / 100,
      amountPaid: inv.amount_paid / 100,
      currency: inv.currency.toUpperCase(),
      pdfUrl: inv.invoice_pdf,
      hostedUrl: inv.hosted_invoice_url,
      dueDate: inv.due_date ? new Date(inv.due_date * 1000) : null,
      periodStart: new Date(inv.period_start * 1000),
      periodEnd: new Date(inv.period_end * 1000),
    }));
  }

  // ─── Webhook Handler ──────────────────────────────────────

  constructWebhookEvent(payload: Buffer, sig: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, sig, this.webhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'invoice.payment_succeeded':
        await this.onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.onInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.trial_will_end':
        await this.onTrialWillEnd(event.data.object as Stripe.Subscription);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  // ─── Webhook handlers ─────────────────────────────────────

  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const { schoolId, planId, cycle } = session.metadata ?? {};
    if (!schoolId || !planId) return;

    const stripeSubscriptionId = session.subscription as string;
    const sub = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);

    await this.prisma.schoolSubscription.create({
      data: {
        schoolId,
        planId,
        billingCycle: cycle as BillingCycle,
        status: 'ACTIVE',
        stripeSubscriptionId,
        stripeCustomerId: session.customer as string,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      },
    });

    this.logger.log(`Subscription activated: school=${schoolId} plan=${planId}`);
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const sub = await this.stripe.subscriptions.retrieve(invoice.subscription as string);
    const { schoolId, planId, cycle } = sub.metadata;

    if (schoolId) {
      // Renew subscription period
      await this.prisma.schoolSubscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
      });

      // Record payment
      await this.prisma.payment.create({
        data: {
          schoolId,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency.toUpperCase(),
          status: 'PAID',
          stripeInvoiceId: invoice.id!,
          stripePaymentIntentId: invoice.payment_intent as string,
          description: `${planId} Plan — ${cycle}`,
          paidAt: new Date(),
        },
      });
    }
  }

  private async onInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
    const subId = invoice.subscription as string;
    await this.prisma.schoolSubscription.updateMany({
      where: { stripeSubscriptionId: subId },
      data: { status: 'PAST_DUE' },
    });
    this.logger.warn(`Invoice payment failed for subscription ${subId}`);
    // TODO: trigger notification to school admin
  }

  private async onSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const { planId, cycle } = subscription.metadata;
    const newStatus = subscription.status === 'active' ? 'ACTIVE' : subscription.status.toUpperCase();

    await this.prisma.schoolSubscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        planId: planId ?? undefined,
        billingCycle: (cycle as BillingCycle) ?? undefined,
        status: newStatus as never,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });
  }

  private async onSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    await this.prisma.schoolSubscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    this.logger.log(`Subscription cancelled: ${subscription.id}`);
  }

  private async onTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
    this.logger.log(`Trial ending soon: ${subscription.id}`);
    // TODO: send "trial ending" notification to school admin
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async getOrCreateCustomer(schoolId: string, email: string): Promise<string> {
    const existing = await this.getCustomerId(schoolId);
    if (existing) return existing;

    const customer = await this.stripe.customers.create({
      email,
      metadata: { schoolId },
    });

    this.logger.log(`Stripe customer created: ${customer.id} for school ${schoolId}`);
    return customer.id;
  }

  private async getCustomerId(schoolId: string): Promise<string | null> {
    const sub = await this.prisma.schoolSubscription.findFirst({
      where: { schoolId },
      select: { stripeCustomerId: true },
      orderBy: { createdAt: 'desc' },
    });
    return sub?.stripeCustomerId ?? null;
  }
}
