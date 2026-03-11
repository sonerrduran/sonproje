import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Headers, RawBodyRequest,
  UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { SubscriptionPlansService, PlanId, BillingCycle } from './subscription-plans.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentSchool } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly stripeService: StripeService,
    private readonly plansService: SubscriptionPlansService,
  ) {}

  // ─── Public: Plans listing ────────────────────────────────

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'List all subscription plans (public, for landing page)' })
  listPlans() {
    return this.plansService.findAll();
  }

  // ─── Authenticated endpoints ──────────────────────────────

  @Get('subscription')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get current subscription status, plan, and trial info' })
  getSubscription(@CurrentSchool() schoolId: string) {
    return this.paymentsService.getSubscription(schoolId);
  }

  @Get('subscription/usage')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Roles(UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Plan usage: students/teachers/games/storage vs limits' })
  getPlanUsage(@CurrentSchool() schoolId: string) {
    return this.paymentsService.getPlanUsage(schoolId);
  }

  @Get('billing')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Roles(UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Billing summary: total paid, payment count, last payment' })
  getBilling(@CurrentSchool() schoolId: string) {
    return this.paymentsService.getBillingSummary(schoolId);
  }

  @Get('history')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Roles(UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Paginated payment history' })
  getHistory(
    @CurrentSchool() schoolId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.paymentsService.getPaymentHistory(schoolId, { page, limit });
  }

  @Get('invoices')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Roles(UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Stripe invoice list with PDF links' })
  getInvoices(@CurrentSchool() schoolId: string) {
    return this.stripeService.listInvoices(schoolId);
  }

  // ─── Checkout ─────────────────────────────────────────────

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Roles(UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Create Stripe checkout session (14-day free trial)' })
  createCheckout(
    @CurrentSchool() schoolId: string,
    @CurrentUser('email') email: string,
    @Body() body: {
      planId: PlanId;
      cycle: BillingCycle;
      successUrl: string;
      cancelUrl: string;
    },
  ) {
    return this.stripeService.createCheckoutSession(
      schoolId, email, body.planId, body.cycle, body.successUrl, body.cancelUrl,
    );
  }

  @Post('portal')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Roles(UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Stripe Customer Portal URL (manage billing, cancel, update card)' })
  getPortal(
    @CurrentSchool() schoolId: string,
    @Body('returnUrl') returnUrl: string,
  ) {
    return this.stripeService.getPortalUrl(schoolId, returnUrl).then((url) => ({ url }));
  }

  @Post('upgrade')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Roles(UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upgrade/downgrade subscription plan (prorated immediately)' })
  async upgrade(
    @CurrentSchool() schoolId: string,
    @Body() body: { newPlanId: PlanId; newCycle: BillingCycle },
  ) {
    const sub = await this.paymentsService.getSubscription(schoolId);
    if (!sub.stripeSubscriptionId) {
      return { message: 'No active Stripe subscription found' };
    }
    return this.stripeService.upgradeSubscription(
      sub.stripeSubscriptionId, body.newPlanId, body.newCycle,
    );
  }

  @Post('cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Roles(UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel subscription at end of billing period' })
  async cancel(
    @CurrentSchool() schoolId: string,
    @Body('immediately') immediately?: boolean,
  ) {
    const sub = await this.paymentsService.getSubscription(schoolId);
    if (!sub.stripeSubscriptionId) {
      return { message: 'No active subscription' };
    }
    await this.stripeService.cancelSubscription(sub.stripeSubscriptionId, immediately);
    return { message: immediately ? 'Subscription cancelled immediately' : 'Subscription will cancel at period end' };
  }

  // ─── Super Admin: Platform analytics ─────────────────────

  @Get('admin/revenue')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform-wide revenue analytics (SUPER_ADMIN only)' })
  getPlatformRevenue(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.paymentsService.getPlatformRevenue({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  // ─── Stripe Webhook (no auth, verifies signature) ─────────

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) throw new Error('No raw body for webhook');
    const event = this.stripeService.constructWebhookEvent(rawBody, sig);
    await this.stripeService.handleWebhookEvent(event);
    return { received: true };
  }
}
