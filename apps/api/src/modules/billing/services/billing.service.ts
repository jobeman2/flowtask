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
   * Get the active subscription for a user account (across all their workspaces / direct user sub)
   */
  async getUserSubscription(userId: string) {
    // 1. Find a subscription directly linked to this userId
    let sub = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
      orderBy: { currentPeriodEnd: 'desc' },
    });

    // 2. Fallback: find best non-FREE subscription on any workspace this user owns
    if (!sub || sub.plan?.code === 'FREE') {
      const ownedWorkspaces = await this.prisma.workspace.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });

      if (ownedWorkspaces.length > 0) {
        const bestSub = await this.prisma.subscription.findFirst({
          where: {
            workspaceId: { in: ownedWorkspaces.map((w) => w.id) },
            status: SubscriptionStatus.ACTIVE,
            plan: { code: { not: 'FREE' } },
          },
          include: { plan: true },
          orderBy: { currentPeriodEnd: 'desc' },
        });
        if (bestSub) sub = bestSub;
      }
    }

    const freePlan = await this.prisma.plan.findUnique({ where: { code: 'FREE' } });

    if (!sub || sub.status !== SubscriptionStatus.ACTIVE) {
      return {
        userId,
        status: 'ACTIVE',
        isFree: true,
        plan: freePlan || { code: 'FREE', name: 'Free Starter', priceEtbMonth: 0, maxProjects: 3, maxMembers: 1, hasAiFeatures: false },
        currentPeriodEnd: null,
      };
    }

    return {
      userId,
      status: sub.status,
      isFree: sub.plan?.code === 'FREE',
      plan: sub.plan,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  /**
   * Get subscription status & limits for a workspace (inherits from workspace owner's user plan)
   */
  async getWorkspaceSubscription(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Always resolve subscription from the workspace owner's user account
    return this.getUserSubscription(workspace.ownerId);
  }

  /**
   * Create a Telebirr payment order
   */
  async createPaymentOrder(userId: string, dto: CreateOrderDto) {
    let targetWorkspaceId = dto.workspaceId;

    let workspace = targetWorkspaceId
      ? await this.prisma.workspace.findUnique({
          where: { id: targetWorkspaceId },
        })
      : null;

    // Fallback: If the passed workspaceId was stale, deleted, or from another device, find or create the user's primary workspace
    if (!workspace) {
      const userWs = await this.prisma.workspace.findFirst({
        where: { ownerId: userId },
        orderBy: { createdAt: 'asc' },
      });

      if (userWs) {
        workspace = userWs;
        targetWorkspaceId = userWs.id;
      } else {
        // Create an initial Personal Workspace for the user if they don't have one
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        workspace = await this.prisma.workspace.create({
          data: {
            name: `${user?.name || 'Personal'} Workspace`,
            type: 'PERSONAL',
            ownerId: userId,
            members: {
              create: {
                userId,
                role: 'OWNER',
              },
            },
          },
        });
        targetWorkspaceId = workspace.id;
      }
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
        workspaceId: targetWorkspaceId,
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

      if (matchResult.smsLog.id && matchResult.smsLog.id !== 'test-mock-log-id') {
        try {
          await this.prisma.telebirrSmsLog.update({
            where: { id: matchResult.smsLog.id },
            data: {
              isMatched: true,
              matchedOrderId: order.id,
            },
          });
        } catch {
          // Ignore
        }
      }

      // 3. Upsert subscription — tied to BOTH the workspace and the user account
      const currentPeriodEnd = new Date(Date.now() + (order.durationDays || 30) * 24 * 60 * 60 * 1000);
      const sub = await this.prisma.subscription.upsert({
        where: { workspaceId: order.workspaceId },
        create: {
          workspaceId: order.workspaceId,
          userId: order.userId,  // Stamp user account so plan is per-user
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd,
        },
        update: {
          userId: order.userId,  // Always keep userId in sync
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
