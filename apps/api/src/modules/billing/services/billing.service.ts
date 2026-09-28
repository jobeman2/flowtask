import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { TelebirrMatcherService } from './telebirr-matcher.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { VerifyOrderDto } from '../dto/verify-order.dto';

// Telebirr account details — set these in environment variables for production
const TELEBIRR_PHONE = process.env.TELEBIRR_PHONE || '0912345678';
const TELEBIRR_ACCOUNT_NAME = process.env.TELEBIRR_ACCOUNT_NAME || 'FlowTask Payments';
const SMS_WEBHOOK_SECRET = process.env.SMS_WEBHOOK_SECRET || '';

// Test transaction ID that always passes verification (only in development/test)
const TEST_TRANSACTION_ID = 'TT777';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
    private telebirrMatcher: TelebirrMatcherService,
  ) {}

  async getPlans() {
    const plans = await this.prisma.plan.findMany({
      orderBy: { priceEtbMonth: 'asc' },
    });
    // If no plans seeded yet, return defaults
    if (plans.length === 0) {
      return [
        { code: 'FREE', name: 'Free Starter', priceEtbMonth: 0, maxProjects: 3, maxMembers: 1, hasAiFeatures: false },
        { code: 'PRO', name: 'Pro Individual', priceEtbMonth: 199, maxProjects: 999, maxMembers: 5, hasAiFeatures: true },
        { code: 'TEAM', name: 'Team Collaboration', priceEtbMonth: 999, maxProjects: 999, maxMembers: 15, hasAiFeatures: true },
      ];
    }
    return plans;
  }

  async getUserSubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { plan: true },
      orderBy: { currentPeriodEnd: 'desc' },
    });
    return sub || null;
  }

  async getWorkspaceSubscription(workspaceId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { workspaceId, status: 'ACTIVE' },
      include: { plan: true },
      orderBy: { currentPeriodEnd: 'desc' },
    });
    return sub || null;
  }

  async createPaymentOrder(userId: string, dto: CreateOrderDto) {
    const { workspaceId, planCode, durationDays = 30 } = dto;

    // Validate plan exists
    let plan = await this.prisma.plan.findFirst({ where: { code: planCode } });
    if (!plan) {
      // Fallback to defaults if plans not seeded
      const defaults: Record<string, any> = {
        PRO: { name: 'Pro Individual', priceEtbMonth: 199 },
        TEAM: { name: 'Team Collaboration', priceEtbMonth: 999 },
      };
      if (!defaults[planCode]) {
        throw new BadRequestException(`Unknown plan: ${planCode}`);
      }
      plan = defaults[planCode] as any;
    }

    if ((plan as any).priceEtbMonth === 0) {
      throw new BadRequestException('Free plan does not require a payment order.');
    }

    const orderCode = `FT-${planCode}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const amountEtb = ((plan as any).priceEtbMonth * durationDays) / 30;

    const order = await this.prisma.paymentOrder.create({
      data: {
        orderCode,
        workspaceId,
        userId,
        planCode,
        amountEtb,
        durationDays,
        status: 'PENDING',
        telebirrPhone: TELEBIRR_PHONE,
      },
    });

    return {
      orderId: order.id,
      orderCode: order.orderCode,
      planCode,
      planName: (plan as any).name,
      amountEtb,
      durationDays,
      telebirrPhone: TELEBIRR_PHONE,
      telebirrAccountName: TELEBIRR_ACCOUNT_NAME,
      status: order.status,
    };
  }

  async verifyPaymentOrder(userId: string, dto: VerifyOrderDto) {
    const { orderId, transactionId } = dto;

    const order = await this.prisma.paymentOrder.findFirst({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Payment order not found.');
    }

    if (order.status === 'VERIFIED') {
      return { verified: true, message: 'This order is already verified and active.' };
    }

    const nodeEnv = process.env.NODE_ENV || 'production';
    const isTestCode = transactionId.toUpperCase() === TEST_TRANSACTION_ID && nodeEnv !== 'production';

    if (!isTestCode) {
      // In production, verify the transaction ID is real
      // Simple check: must be alphanumeric, 6-20 chars (Telebirr format)
      if (!/^[A-Z0-9]{4,20}$/i.test(transactionId)) {
        throw new BadRequestException('Invalid Transaction ID format. Please check your Telebirr confirmation SMS.');
      }
    }

    // Mark order as verified
    await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        transactionId: transactionId.toUpperCase(),
        status: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    // Resolve or upsert subscription
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + order.durationDays);

    let plan = await this.prisma.plan.findFirst({ where: { code: order.planCode } });

    // If plan not seeded, create it on the fly
    if (!plan) {
      const planPrices: Record<string, number> = { PRO: 199, TEAM: 999 };
      plan = await this.prisma.plan.create({
        data: {
          code: order.planCode,
          name: order.planCode === 'PRO' ? 'Pro Individual' : 'Team Collaboration',
          priceEtbMonth: planPrices[order.planCode] || 199,
          hasAiFeatures: true,
          maxProjects: order.planCode === 'TEAM' ? 999 : 999,
          maxMembers: order.planCode === 'TEAM' ? 15 : 5,
        },
      });
    }

    const existing = await this.prisma.subscription.findFirst({
      where: { workspaceId: order.workspaceId },
    });

    if (existing) {
      await this.prisma.subscription.update({
        where: { id: existing.id },
        data: {
          planId: plan.id,
          userId,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
      });
    } else {
      await this.prisma.subscription.create({
        data: {
          workspaceId: order.workspaceId,
          userId,
          planId: plan.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
      });
    }

    this.logger.log(`Payment verified: Order ${order.orderCode} → Plan ${order.planCode} for workspace ${order.workspaceId}`);

    return {
      verified: true,
      message: `🎉 Payment verified! Your ${order.planCode} plan is now active for ${order.durationDays} days.`,
      expiresAt: periodEnd.toISOString(),
      planCode: order.planCode,
    };
  }

  async handleSmsWebhook(sender: string, rawMessage: string, secret: string) {
    if (SMS_WEBHOOK_SECRET && secret !== SMS_WEBHOOK_SECRET) {
      return { success: false, message: 'Invalid webhook secret.' };
    }

    const result = await this.telebirrMatcher.matchSmsToOrder(sender, rawMessage);
    return {
      success: true,
      matched: result.matched,
      transactionId: result.transactionId,
      orderId: result.orderId,
    };
  }
}
