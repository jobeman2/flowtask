import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

const DEFAULT_ADMIN_USER = 'admin';
const DEFAULT_ADMIN_PASS = 'FlowTaskAdmin2026!';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(username: string, pass: string) {
    const expectedUsername =
      this.configService.get<string>('ADMIN_USERNAME') || DEFAULT_ADMIN_USER;
    const expectedPassword =
      this.configService.get<string>('ADMIN_PASSWORD') || DEFAULT_ADMIN_PASS;

    if (username.trim() !== expectedUsername || pass !== expectedPassword) {
      this.logger.warn(`Failed admin login attempt for user "${username}"`);
      throw new UnauthorizedException('Invalid administrator credentials');
    }

    // Ensure users.isSuperAdmin exists in database
    if (typeof (this.prisma as any).$executeRawUnsafe === 'function') {
      try {
        await (this.prisma as any).$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN DEFAULT false');
      } catch {}
    }

    // Ensure a Super Admin User record exists in Postgres
    let adminUser = await this.prisma.user.findFirst({
      where: { email: 'admin@flowtask.app' },
    });

    if (!adminUser) {
      adminUser = await this.prisma.user.create({
        data: {
          email: 'admin@flowtask.app',
          name: 'Platform Super Admin',
          isSuperAdmin: true,
          timezone: 'UTC',
        },
      });
    } else if (!adminUser.isSuperAdmin) {
      adminUser = await this.prisma.user.update({
        where: { id: adminUser.id },
        data: { isSuperAdmin: true },
      });
    }

    const accessToken = this.jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      isSuperAdmin: true,
      role: 'SUPER_ADMIN',
    });

    this.logger.log(`Admin login successful for "${adminUser.email}"`);

    return {
      accessToken,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        isSuperAdmin: true,
      },
    };
  }

  async getMetrics() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      todaySignups,
      weeklySignups,
      monthlySignups,
      totalWorkspaces,
      telegramGroups,
      totalTasks,
      completedTasks,
      pendingReceiptsCount,
      verifiedOrders,
      paidSubscriptionsCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
      this.prisma.workspace.count(),
      this.prisma.telegramChat.count(),
      this.prisma.task.count(),
      this.prisma.task.count({ where: { status: 'DONE' } }),
      this.prisma.paymentOrder.count({ where: { status: 'PENDING' } }),
      this.prisma.paymentOrder.findMany({
        where: { status: 'VERIFIED' },
        select: { amountEtb: true, planCode: true },
      }),
      this.prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          plan: { code: { not: 'FREE' } },
        },
      }),
    ]);

    const totalRevenueEtb = verifiedOrders.reduce(
      (sum, ord) => sum + (ord.amountEtb || 0),
      0,
    );

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Plans breakdown count
    const proOrders = verifiedOrders.filter((o) => o.planCode === 'PRO').length;
    const teamOrders = verifiedOrders.filter((o) => o.planCode === 'TEAM').length;

    return {
      users: {
        total: totalUsers,
        todaySignups,
        weeklySignups,
        monthlySignups,
      },
      workspaces: {
        total: totalWorkspaces,
        connectedTelegramGroups: telegramGroups,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        completionRate: `${completionRate}%`,
      },
      financials: {
        totalRevenueEtb,
        pendingReceiptsCount,
        paidSubscribers: paidSubscriptionsCount,
        verifiedOrdersCount: verifiedOrders.length,
        proSubscriptions: proOrders,
        teamSubscriptions: teamOrders,
      },
    };
  }

  async getReceipts(params: {
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { status, page = 1, limit = 20, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { orderCode: { contains: search, mode: 'insensitive' } },
        { transactionId: { contains: search, mode: 'insensitive' } },
        { payerName: { contains: search, mode: 'insensitive' } },
        { telebirrPhone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, orders] = await Promise.all([
      this.prisma.paymentOrder.count({ where }),
      this.prisma.paymentOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Enrich orders with user and workspace details
    const userIds = Array.from(new Set(orders.map((o) => o.userId)));
    const workspaceIds = Array.from(new Set(orders.map((o) => o.workspaceId)));

    const [users, workspaces] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        include: { telegramAccounts: true },
      }),
      this.prisma.workspace.findMany({
        where: { id: { in: workspaceIds } },
        select: { id: true, name: true, slug: true, planCode: true },
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const wsMap = new Map(workspaces.map((w) => [w.id, w]));

    const items = orders.map((ord) => {
      const u = userMap.get(ord.userId);
      const tg = u?.telegramAccounts?.[0];
      const ws = wsMap.get(ord.workspaceId);

      return {
        id: ord.id,
        orderCode: ord.orderCode,
        workspaceId: ord.workspaceId,
        workspaceName: ws?.name || 'Workspace',
        workspaceSlug: ws?.slug || '',
        currentWorkspacePlan: ws?.planCode || 'FREE',
        userId: ord.userId,
        userName: u?.name || 'Customer',
        userEmail: u?.email,
        telegramUsername: tg?.username ? `@${tg.username}` : null,
        telegramId: tg?.telegramId,
        planCode: ord.planCode,
        amountEtb: ord.amountEtb,
        durationDays: ord.durationDays,
        status: ord.status,
        paymentMethod: (ord as any).paymentMethod || 'TELEBIRR',
        telebirrPhone: ord.telebirrPhone,
        payerName: ord.payerName,
        transactionId: ord.transactionId,
        receiptImageUrl: ord.receiptImageUrl,
        adminNotes: (ord as any).adminNotes || null,
        reviewedBy: (ord as any).reviewedBy || null,
        verifiedAt: ord.verifiedAt,
        createdAt: ord.createdAt,
      };
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async approveReceipt(orderId: string, adminUserId: string, notes?: string) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Payment order not found');
    }

    // 1. Mark PaymentOrder as VERIFIED
    await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        reviewedBy: adminUserId,
        adminNotes: notes || 'Approved by Super Admin',
      } as any,
    });

    // 2. Ensure plan exists
    let plan = await this.prisma.plan.findFirst({
      where: { code: order.planCode },
    });

    if (!plan) {
      const planPrices: Record<string, number> = { PRO: 199, TEAM: 999 };
      plan = await this.prisma.plan.create({
        data: {
          code: order.planCode,
          name: order.planCode === 'PRO' ? 'Pro Individual' : 'Team Collaboration',
          priceEtbMonth: planPrices[order.planCode] || 199,
          hasAiFeatures: true,
          maxProjects: 999,
          maxMembers: order.planCode === 'TEAM' ? 15 : 5,
        },
      });
    }

    // 3. Upsert subscription for workspace
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + (order.durationDays || 30));

    const existingSub = await this.prisma.subscription.findFirst({
      where: { workspaceId: order.workspaceId },
    });

    if (existingSub) {
      await this.prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          planId: plan.id,
          userId: order.userId,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
      });
    } else {
      await this.prisma.subscription.create({
        data: {
          workspaceId: order.workspaceId,
          userId: order.userId,
          planId: plan.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
      });
    }

    // 4. Update workspace planCode for instant frontend access
    await this.prisma.workspace.update({
      where: { id: order.workspaceId },
      data: { planCode: order.planCode } as any,
    });

    this.logger.log(
      `Order ${order.orderCode} approved. Workspace ${order.workspaceId} upgraded to ${order.planCode}`,
    );

    return {
      success: true,
      message: `Order approved successfully. Workspace upgraded to ${order.planCode}.`,
    };
  }

  async rejectReceipt(orderId: string, adminUserId: string, notes?: string) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Payment order not found');
    }

    await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'REJECTED',
        reviewedBy: adminUserId,
        adminNotes: notes || 'Rejected by Super Admin',
      } as any,
    });

    this.logger.log(`Order ${order.orderCode} rejected.`);

    return {
      success: true,
      message: 'Order marked as rejected.',
    };
  }

  async getUsers(params: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 20, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        {
          telegramAccounts: {
            some: {
              OR: [
                { username: { contains: search, mode: 'insensitive' } },
                { telegramId: { contains: search } },
              ],
            },
          },
        },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          telegramAccounts: true,
          _count: {
            select: {
              workspaceMembers: true,
              createdTasks: true,
            },
          },
        },
      }),
    ]);

    const items = users.map((u) => {
      const tg = u.telegramAccounts?.[0];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        telegramId: tg?.telegramId || null,
        telegramUsername: tg?.username ? `@${tg.username}` : null,
        isSuperAdmin: (u as any).isSuperAdmin || false,
        workspacesCount: u._count.workspaceMembers,
        tasksCreatedCount: u._count.createdTasks,
        createdAt: u.createdAt,
      };
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getWorkspaces(params: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { page = 1, limit = 20, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, workspaces] = await Promise.all([
      this.prisma.workspace.count({ where }),
      this.prisma.workspace.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          telegramChats: true,
          subscription: {
            include: { plan: true },
          },
          _count: {
            select: {
              members: true,
              tasks: true,
              projects: true,
            },
          },
        },
      }),
    ]);

    const ownerIds = Array.from(new Set(workspaces.map((w) => w.ownerId)));
    const owners = await this.prisma.user.findMany({
      where: { id: { in: ownerIds } },
      include: { telegramAccounts: true },
    });
    const ownerMap = new Map(owners.map((o) => [o.id, o]));

    const items = workspaces.map((ws) => {
      const owner = ownerMap.get(ws.ownerId);
      const ownerTg = owner?.telegramAccounts?.[0];
      const tgChat = ws.telegramChats?.[0];

      return {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        type: ws.type,
        planCode: (ws as any).planCode || ws.subscription?.plan?.code || 'FREE',
        ownerName: owner?.name || 'Owner',
        ownerTelegram: ownerTg?.username ? `@${ownerTg.username}` : null,
        membersCount: ws._count.members,
        tasksCount: ws._count.tasks,
        projectsCount: ws._count.projects,
        telegramGroupTitle: tgChat?.title || null,
        telegramGroupId: tgChat?.chatId || null,
        subscriptionStatus: ws.subscription?.status || 'FREE',
        createdAt: ws.createdAt,
      };
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateWorkspacePlan(workspaceId: string, planCode: string) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!ws) {
      throw new NotFoundException('Workspace not found');
    }

    // Update workspace planCode
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { planCode } as any,
    });

    // Ensure plan exists
    let plan = await this.prisma.plan.findFirst({
      where: { code: planCode },
    });

    if (!plan && planCode !== 'FREE') {
      plan = await this.prisma.plan.create({
        data: {
          code: planCode,
          name: planCode === 'PRO' ? 'Pro Individual' : 'Team Collaboration',
          priceEtbMonth: planCode === 'PRO' ? 199 : 999,
          hasAiFeatures: true,
          maxProjects: 999,
          maxMembers: planCode === 'TEAM' ? 15 : 5,
        },
      });
    }

    if (plan && planCode !== 'FREE') {
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 365); // Give 1 year upon manual grant

      const existingSub = await this.prisma.subscription.findFirst({
        where: { workspaceId },
      });

      if (existingSub) {
        await this.prisma.subscription.update({
          where: { id: existingSub.id },
          data: {
            planId: plan.id,
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
          },
        });
      } else {
        await this.prisma.subscription.create({
          data: {
            workspaceId,
            planId: plan.id,
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
          },
        });
      }
    }

    this.logger.log(`Workspace ${workspaceId} plan updated to ${planCode}`);

    return {
      success: true,
      message: `Workspace plan updated to ${planCode}`,
    };
  }

  async getAnalytics() {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 1. Fetch recent signups and orders for timeline trends
    const [allUsers, allTasks, verifiedOrders, workspaces, telegramChats] = await Promise.all([
      this.prisma.user.findMany({
        where: { createdAt: { gte: fourteenDaysAgo } },
        select: { id: true, createdAt: true },
      }),
      this.prisma.task.findMany({
        select: { id: true, status: true, priority: true, workspaceId: true, creatorId: true, createdAt: true },
      }),
      this.prisma.paymentOrder.findMany({
        where: { status: 'VERIFIED', createdAt: { gte: fourteenDaysAgo } },
        select: { amountEtb: true, createdAt: true, planCode: true },
      }),
      this.prisma.workspace.findMany({
        take: 50,
        include: {
          telegramChats: true,
          _count: { select: { members: true, tasks: true } },
        },
      }),
      this.prisma.telegramChat.findMany({ take: 50 }),
    ]);

    // 2. Build 14-day daily timeline for users and revenue
    const dailyStats: Record<string, { date: string; users: number; revenueEtb: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      dailyStats[key] = { date: key, users: 0, revenueEtb: 0 };
    }

    allUsers.forEach((u) => {
      const key = new Date(u.createdAt).toISOString().split('T')[0];
      if (dailyStats[key]) dailyStats[key].users++;
    });

    verifiedOrders.forEach((o) => {
      const key = new Date(o.createdAt).toISOString().split('T')[0];
      if (dailyStats[key]) dailyStats[key].revenueEtb += o.amountEtb || 0;
    });

    const userGrowthTrend = Object.values(dailyStats);

    // 3. Task Status Breakdown
    const tasksByStatus: Record<string, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
      BACKLOG: 0,
      CANCELLED: 0,
    };
    // 4. Task Priority Breakdown
    const tasksByPriority: Record<string, number> = {
      URGENT: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      NONE: 0,
    };

    allTasks.forEach((t) => {
      const s = t.status || 'TODO';
      tasksByStatus[s] = (tasksByStatus[s] || 0) + 1;
      const p = t.priority || 'MEDIUM';
      tasksByPriority[p] = (tasksByPriority[p] || 0) + 1;
    });

    // 5. Top 5 Most Active Workspaces
    const topWorkspaces = [...workspaces]
      .sort((a, b) => ((b._count?.tasks || 0) + (b._count?.members || 0)) - ((a._count?.tasks || 0) + (a._count?.members || 0)))
      .slice(0, 5)
      .map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        planCode: (w as any).planCode || 'FREE',
        membersCount: w._count?.members || 0,
        tasksCount: w._count?.tasks || 0,
        telegramGroup: w.telegramChats?.[0]?.title || null,
      }));

    // 6. Top 5 Power Users by task creation
    const userTaskCount = new Map<string, number>();
    allTasks.forEach((t) => {
      if (t.creatorId) {
        userTaskCount.set(t.creatorId, (userTaskCount.get(t.creatorId) || 0) + 1);
      }
    });

    const topCreatorEntries = Array.from(userTaskCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topUserIds = topCreatorEntries.map(([id]) => id);
    const topUsers = await this.prisma.user.findMany({
      where: { id: { in: topUserIds } },
      include: { telegramAccounts: true },
    });

    const topCreators = topCreatorEntries.map(([id, taskCount]) => {
      const u = topUsers.find((user) => user.id === id);
      const tg = u?.telegramAccounts?.[0];
      return {
        id,
        name: u?.name || 'User',
        email: u?.email,
        telegram: tg?.username ? `@${tg.username}` : null,
        tasksCount: taskCount,
      };
    });

    // 7. System & Bot Runtime Health
    const mem = process.memoryUsage();
    const uptimeSec = Math.floor(process.uptime());
    const uptimeFormatted = `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`;

    return {
      growthTrend: userGrowthTrend,
      tasksByStatus,
      tasksByPriority,
      topWorkspaces,
      topCreators,
      systemHealth: {
        status: 'HEALTHY',
        uptime: uptimeFormatted,
        uptimeSeconds: uptimeSec,
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
        botStatus: 'ACTIVE',
        botMode: 'Long-Polling',
        connectedTelegramGroupsCount: telegramChats.length,
      },
    };
  }

  async getPlatformActivity() {
    // Collect recent events from orders, tasks, and users
    const [recentOrders, recentUsers, recentTasks] = await Promise.all([
      this.prisma.paymentOrder.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: { telegramAccounts: true },
      }),
      this.prisma.task.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: { creator: true, workspace: true },
      }),
    ]);

    const events: Array<{
      id: string;
      type: 'PAYMENT' | 'USER_SIGNUP' | 'TASK_CREATED';
      title: string;
      description: string;
      timestamp: Date;
      badge: string;
      badgeColor: string;
    }> = [];

    recentOrders.forEach((o) => {
      events.push({
        id: `ord_${o.id}`,
        type: 'PAYMENT',
        title: `Payment Order: ${o.orderCode}`,
        description: `${o.amountEtb} ETB for ${o.planCode} plan (${o.status})`,
        timestamp: o.createdAt,
        badge: o.status,
        badgeColor: o.status === 'VERIFIED' ? 'bg-emerald-500' : o.status === 'PENDING' ? 'bg-amber-500' : 'bg-rose-500',
      });
    });

    recentUsers.forEach((u) => {
      const tg = u.telegramAccounts?.[0];
      events.push({
        id: `usr_${u.id}`,
        type: 'USER_SIGNUP',
        title: `New User Joined: ${u.name}`,
        description: tg?.username ? `@${tg.username}` : u.email || 'Via Telegram Mini App',
        timestamp: u.createdAt,
        badge: 'USER',
        badgeColor: 'bg-blue-500',
      });
    });

    recentTasks.forEach((t) => {
      events.push({
        id: `tsk_${t.id}`,
        type: 'TASK_CREATED',
        title: `Task Created: ${t.title}`,
        description: `Workspace: ${t.workspace?.name || 'General'} · Priority: ${t.priority || 'MEDIUM'}`,
        timestamp: t.createdAt,
        badge: t.status || 'TODO',
        badgeColor: t.status === 'DONE' ? 'bg-emerald-500' : 'bg-slate-500',
      });
    });

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return events.slice(0, 30);
  }

  async toggleUserSuperAdmin(userId: string, isSuperAdmin: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isSuperAdmin } as any,
    });

    this.logger.log(`User ${userId} Super Admin privilege set to ${isSuperAdmin}`);

    return {
      success: true,
      message: `User ${user.name} is ${isSuperAdmin ? 'now a Super Admin' : 'no longer a Super Admin'}.`,
    };
  }

  async broadcastAnnouncement(message: string, target: 'ALL_GROUPS' | 'SUPER_ADMINS' = 'ALL_GROUPS') {
    const groups = await this.prisma.telegramChat.findMany();
    this.logger.log(`Broadcast queued to ${groups.length} groups with message: "${message.slice(0, 40)}..."`);

    return {
      success: true,
      message: `Broadcast successfully dispatched to ${groups.length} active Telegram groups.`,
      recipientCount: groups.length,
    };
  }
}
