import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { TelebirrMatcherService } from './telebirr-matcher.service';
import { TelegramService } from '../../telegram/telegram.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { VerifyOrderDto } from '../dto/verify-order.dto';
import { WorkspaceRole, WorkspaceType, SubscriptionStatus } from '@flowtask/database';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private telebirrMatcher: TelebirrMatcherService,
    private telegramService: TelegramService,
    private configService: ConfigService
  ) {}

  /**
   * Get all active pricing plans
   */
  async getPlans() {
    const plans = await this.prisma.plan.findMany();
    return plans.sort((a: any, b: any) => a.priceEtbMonth - b.priceEtbMonth);
  }

  /**
   * Get subscription status & limits for a workspace
   */
  async getWorkspaceSubscription(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    let sub = await this.prisma.subscription.findUnique({
      where: { workspaceId },
      include: { plan: true },
    });

    // If no direct subscription on this workspace, inherit from workspace owner's active subscription
    if (!sub || sub.status !== SubscriptionStatus.ACTIVE || sub.plan?.code === 'FREE') {
      const ownerWorkspaces = await this.prisma.workspace.findMany({
        where: { ownerId: workspace.ownerId },
      });

      for (const ow of ownerWorkspaces) {
        if (ow.id === workspaceId) continue;
        const ownerSub = await this.prisma.subscription.findUnique({
          where: { workspaceId: ow.id },
          include: { plan: true },
        });
        if (ownerSub && ownerSub.status === SubscriptionStatus.ACTIVE && ownerSub.plan?.code !== 'FREE') {
          sub = ownerSub;
          break;
        }
      }
    }

    // If still no subscription, return Free plan
    if (!sub || sub.status !== SubscriptionStatus.ACTIVE) {
      const freePlan = await this.prisma.plan.findUnique({ where: { code: 'FREE' } }) || {
        code: 'FREE',
        name: 'Starter (Free)',
        priceEtbMonth: 0,
        maxMembers: 3,
        maxProjects: 2,
        maxTasks: 25,
        maxGroups: 1,
        hasAiFeatures: false,
        hasAttachments: false,
        hasDailyDigest: false,
        hasRecurring: false,
      };

      return {
        workspaceId,
        status: sub ? sub.status : 'ACTIVE',
        isFree: true,
        plan: freePlan,
        currentPeriodEnd: null,
      };
    }

    return {
      workspaceId,
      status: sub.status,
      isFree: sub.plan?.code === 'FREE',
      plan: sub.plan,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  /**
   * Create a Telebirr payment order
   */
  async createPaymentOrder(userId: string, dto: CreateOrderDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: dto.workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const plan = await this.prisma.plan.findUnique({
      where: { code: dto.planCode.toUpperCase() },
    });

    if (!plan || plan.code === 'FREE') {
      throw new BadRequestException('Invalid plan selected for upgrade');
    }

    const durationDays = dto.durationDays || 30;
    const amountEtb = plan.priceEtbMonth * (durationDays / 30);
    const orderCode = `FT-${Math.floor(1000 + Math.random() * 9000)}`;

    const telebirrPhone = this.configService.get<string>('TELEBIRR_PHONE') || '0911223344';
    const telebirrAccountName = this.configService.get<string>('TELEBIRR_ACCOUNT_NAME') || 'Jovany / FlowTask';

    const order = await this.prisma.paymentOrder.create({
      data: {
        orderCode,
        workspaceId: dto.workspaceId,
        userId,
        planCode: plan.code,
        amountEtb,
        durationDays,
        status: 'PENDING',
        telebirrPhone,
        payerName: telebirrAccountName,
      },
    });

    this.logger.log(`Created payment order ${order.id} (${orderCode}) for workspace ${dto.workspaceId}`);

    return {
      orderId: order.id,
      orderCode: order.orderCode,
      amountEtb: order.amountEtb,
      planName: plan.name,
      planCode: plan.code,
      telebirrPhone,
      telebirrAccountName,
      instructions: [
        `1. Open your Telebirr app and transfer exactly ${amountEtb} ETB to ${telebirrPhone} (${telebirrAccountName}).`,
        `2. Use reference code "${orderCode}" in the transfer remark if possible.`,
        `3. Copy the Transaction Number (TxID) from your Telebirr confirmation SMS/receipt and paste it below to verify.`,
      ],
    };
  }

  /**
   * Submit Transaction ID to verify and activate subscription
   */
  async verifyPaymentOrder(userId: string, dto: VerifyOrderDto) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException('Payment order not found');
    }

    if (order.status === 'COMPLETED') {
      return {
        success: true,
        alreadyVerified: true,
        message: 'This payment order is already completed and active!',
      };
    }

    const plan = await this.prisma.plan.findUnique({
      where: { code: order.planCode },
    });

    if (!plan) {
      throw new NotFoundException('Selected plan not found');
    }

    const cleanTxId = dto.transactionId.trim().toUpperCase();

    // 1. Attempt automated matching against Telebirr SMS logs
    const matchResult = await this.telebirrMatcher.matchTransaction(cleanTxId, order.amountEtb);

    if (matchResult.matched && matchResult.smsLog) {
      // 2. Complete order and activate subscription
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'COMPLETED',
          transactionId: cleanTxId,
          receiptImageUrl: dto.receiptImageUrl || null,
          verifiedAt: new Date(),
        },
      });

      await this.prisma.telebirrSmsLog.update({
        where: { id: matchResult.smsLog.id },
        data: {
          isMatched: true,
          matchedOrderId: order.id,
        },
      });

      // 3. Upsert Workspace Subscription
      const currentPeriodEnd = new Date(Date.now() + (order.durationDays || 30) * 24 * 60 * 60 * 1000);
      const sub = await this.prisma.subscription.upsert({
        where: { workspaceId: order.workspaceId },
        create: {
          workspaceId: order.workspaceId,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd,
        },
        update: {
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd,
        },
        include: { plan: true },
      });

      // 4. Update workspace type
      await this.prisma.workspace.update({
        where: { id: order.workspaceId },
        data: {
          type: plan.code === 'ENTERPRISE' ? WorkspaceType.ENTERPRISE : WorkspaceType.TEAM,
        },
      });

      // 5. Send celebratory Telegram notification
      try {
        const tgAccount = await this.prisma.telegramAccount.findFirst({
          where: { userId },
        });
        if (tgAccount?.telegramId) {
          const webAppUrl = this.configService.get<string>('WEB_BASE_URL') || 'http://localhost:3000';
          await this.telegramService.sendTelegramMessage(
            tgAccount.telegramId,
            `🎉 *Payment Verified & Upgraded!*\n\n` +
            `💎 *Plan:* *${plan.name}*\n` +
            `🧾 *TxID:* \`${cleanTxId}\`\n` +
            `📅 *Valid Until:* ${currentPeriodEnd.toLocaleDateString()}\n\n` +
            `Your team limits, attachments, and automated digests are now fully unlocked. Enjoy!`,
            {
              reply_markup: {
                inline_keyboard: [[{ text: '📱 Open Board', web_app: { url: webAppUrl } }]],
              },
            }
          );
        }
      } catch (err: any) {
        this.logger.warn(`Failed to send Telegram confirmation: ${err.message}`);
      }

      return {
        success: true,
        verified: true,
        planName: plan.name,
        planCode: plan.code,
        expiresAt: currentPeriodEnd,
        message: `🎉 Success! Your workspace has been upgraded to ${plan.name}!`,
      };
    }

    // If SMS hasn't landed yet or amount differs, put in PENDING_VERIFICATION
    await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'PENDING_VERIFICATION',
        transactionId: cleanTxId,
        receiptImageUrl: dto.receiptImageUrl || null,
      },
    });

    return {
      success: true,
      verified: false,
      pending: true,
      reason: matchResult.reason,
      message:
        'Your transaction ID has been recorded. Our system is auto-verifying with Telebirr incoming SMS. Your plan will activate automatically within moments!',
    };
  }

  /**
   * Handle incoming raw SMS from the SMS Gateway webhook
   */
  async handleSmsWebhook(sender: string, rawMessage: string, secretToken?: string) {
    const configuredSecret = this.configService.get<string>('SMS_GATEWAY_SECRET');
    if (configuredSecret && secretToken !== configuredSecret) {
      throw new ForbiddenException('Invalid SMS gateway authorization secret');
    }

    const result = await this.telebirrMatcher.ingestSms(sender, rawMessage);
    if (!result.parsed?.txId) {
      return { success: true, processed: false, reason: 'No TxID found in SMS' };
    }

    const txId = result.parsed.txId;
    const amount = result.parsed.amount || 0;

    // Check if there is an order in PENDING_VERIFICATION waiting for this exact TxID
    const pendingOrder = await this.prisma.paymentOrder.findFirst({
      where: {
        transactionId: txId,
        status: 'PENDING_VERIFICATION',
      },
    });

    if (pendingOrder && amount >= pendingOrder.amountEtb) {
      this.logger.log(`Auto-completing pending order ${pendingOrder.id} for TxID ${txId}`);
      await this.verifyPaymentOrder(pendingOrder.userId, {
        orderId: pendingOrder.id,
        transactionId: txId,
      });
    }

    return { success: true, processed: true, txId, amount };
  }
}
