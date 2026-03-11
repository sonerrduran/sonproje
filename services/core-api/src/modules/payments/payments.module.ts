import { Module } from '@nestjs/common';

// Services
import { SubscriptionPlansService } from './subscription-plans.service';
import { StripeService } from './stripe.service';
import { PaymentsService } from './payments.service';

// Controller
import { PaymentsController } from './payments.controller';

/**
 * Payments Module — Subscription & Billing System
 *
 * APIs at /api/v1/payments:
 *  GET  /payments/plans                → public plan listing
 *  GET  /payments/subscription         → school's current plan + trial status
 *  GET  /payments/subscription/usage   → resource usage vs plan limits
 *  GET  /payments/billing              → total paid, last payment
 *  GET  /payments/history              → paginated payment records
 *  GET  /payments/invoices             → Stripe invoice list with PDF URLs
 *  POST /payments/checkout             → Stripe checkout session (14-day trial)
 *  POST /payments/portal               → Stripe billing portal URL
 *  POST /payments/upgrade              → change plan with proration
 *  POST /payments/cancel               → cancel at period end
 *  GET  /payments/admin/revenue        → platform revenue (super_admin)
 *  POST /payments/webhook              → Stripe webhook (no auth, sig-verified)
 *
 * Plans:
 *  STARTER   → $29/mo  | 200 students  | 5GB storage
 *  PRO       → $79/mo  | 1000 students | 50GB storage | analytics + branding
 *  ENTERPRISE→ custom  | 100k students | 1TB storage  | full features
 *
 * Required env vars:
 *  STRIPE_SECRET_KEY
 *  STRIPE_WEBHOOK_SECRET
 *  STRIPE_PRICE_STARTER_MONTHLY / _YEARLY
 *  STRIPE_PRICE_PRO_MONTHLY / _YEARLY
 *  STRIPE_PRICE_ENTERPRISE_MONTHLY / _YEARLY
 *
 * IMPORTANT: /payments/webhook requires `app.useBodyParser(false)` or raw body
 * middleware so Stripe signature verification works. Add in main.ts:
 *   app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
 */
@Module({
  controllers: [PaymentsController],
  providers: [
    SubscriptionPlansService,
    StripeService,
    PaymentsService,
  ],
  exports: [
    SubscriptionPlansService, // Export for limit-checking in other modules
    PaymentsService,
  ],
})
export class PaymentsModule {}
